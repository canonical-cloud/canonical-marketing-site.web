// Admission guards are shared by the Edge handler and executable Node tests.
// They deliberately do not access secrets, databases, or send mail.
export async function readBodyBounded(request, maxBytes = 16_384) {
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    throw new Error('payload_too_large');
  }
  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let total = 0;
  let body = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error('payload_too_large');
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } catch (error) {
    if (error instanceof Error && error.message === 'payload_too_large') throw error;
    throw new Error('invalid_json');
  } finally {
    reader.releaseLock();
  }
  return body;
}

// PostgreSQL JSONB serializes object keys in a different order from JavaScript
// insertion order. Compare canonical structures, not textual key order.
const canonicalJson = (value) => JSON.stringify(value, (_key, object) =>
  object && typeof object === 'object' && !Array.isArray(object)
    ? Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)))
    : object,
);

// An idempotency UUID identifies one immutable intent, not an unlimited
// permission to acknowledge a different recipient or recomputed quote.
export function matchesStoredSubmission(prior, intent) {
  if (!prior || typeof prior !== 'object' ||
      prior.kind !== intent.kind || prior.source !== intent.source ||
      prior.email !== intent.email || prior.company !== intent.company) return false;
  if (intent.kind === 'contact') {
    return prior.quote_payload == null &&
      prior.name === intent.name &&
      prior.topic === intent.topic &&
      prior.message === intent.message;
  }
  if (intent.kind !== 'quote' || !intent.quote || !prior.quote_payload ||
      typeof prior.quote_payload !== 'object') return false;
  const original = prior.quote_payload;
  return original.scopeSchemaVersion === intent.quote.scopeSchemaVersion &&
    canonicalJson(original.selection) === canonicalJson(intent.quote.selection) &&
    canonicalJson(original.range) === canonicalJson(intent.quote.range);
}
