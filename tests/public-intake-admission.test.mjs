import assert from 'node:assert/strict';
import test from 'node:test';
import { readBodyBounded, matchesStoredSubmission } from '../supabase/functions/public-intake/admission.mjs';
import { computeQuote } from '../supabase/functions/public-intake/quote-engine.mjs';
import schema from '../src/data/quote-scope.json' with { type: 'json' };

const scope = Object.fromEntries(schema.fields.map(({ key, defaultId }) => [key, defaultId]));
const selection = {
  speedWeeks: 5, standardIds: ['soc2', 'iso27001'], deliveryDepthId: 'managed',
  complexityId: 'growing', companyStageId: 'business', employeeBandId: '11-50',
  sectorId: 'technology', scope,
};
const quote = computeQuote(selection);
const envelope = {
  kind: 'quote', source: 'canonical.plus/quote', email: 'buyer@example.com',
  company: 'Example Co', quote,
};
const prior = {
  id: '123e4567-e89b-42d3-a456-426614174001',
  delivery_status: 'sent', updated_at: '2026-11-10T00:00:00Z',
  kind: envelope.kind, source: envelope.source, email: envelope.email,
  company: envelope.company, quote_payload: quote,
};
const idempotencyKey = '123e4567-e89b-42d3-a456-426614174000';
const payload = (changes = {}) => ({
  kind: 'quote', source: 'canonical.plus/quote', email: envelope.email,
  company: envelope.company, idempotencyKey, selection, ...changes,
});
const intakeRequest = (data) => new Request('https://unused.invalid/functions/v1/public-intake', {
  method: 'POST',
  headers: { origin: 'https://canonical.plus', 'content-type': 'application/json' },
  body: JSON.stringify(data),
});

test('same intent can be acknowledged but changed recipient, company, or selection cannot', () => {
  assert.equal(matchesStoredSubmission(prior, envelope), true);
  // Database JSONB may return canonicalized/reordered keys at every level.
  const reorderJsonb = (v) => JSON.parse(JSON.stringify(v, (_key, object) =>
    object && typeof object === 'object' && !Array.isArray(object)
      ? Object.fromEntries(Object.entries(object).sort(([a], [b]) => b.localeCompare(a)))
      : object));
  assert.equal(matchesStoredSubmission({ ...prior, quote_payload: reorderJsonb(quote) }, envelope), true);
  assert.equal(matchesStoredSubmission(prior, { ...envelope, email: 'attacker@example.com' }), false);
  assert.equal(matchesStoredSubmission(prior, { ...envelope, company: 'Other Co' }), false);
  assert.equal(matchesStoredSubmission(prior, {
    ...envelope, quote: { ...quote, selection: { ...quote.selection, employeeBandId: '1001-plus' } },
  }), false);
  assert.equal(matchesStoredSubmission(prior, {
    ...envelope, quote: { ...quote, range: { ...quote.range, lowerUsd: 1 } },
  }), false);
  assert.equal(matchesStoredSubmission(prior, { ...envelope, source: 'canonical.plus/contact' }), false);
  const contact = {
    kind: 'contact', source: 'canonical.plus/contact', email: 'c@example.com',
    company: 'Contoso', name: 'Chris', topic: 'readiness', message: 'Please call about my readiness review.',
  };
  assert.equal(matchesStoredSubmission({ ...contact, quote_payload: null }, contact), true);
  assert.equal(matchesStoredSubmission({ ...contact, quote_payload: null }, { ...contact, message: 'A different request' }), false);
});

test('bounded stream rejects advertised and actual oversize before holding entire body', async () => {
  let cancelCalled = false;
  const stream = new ReadableStream({
    pull(controller) {
      controller.enqueue(new Uint8Array(9000));
      controller.enqueue(new Uint8Array(9000));
    },
    cancel() { cancelCalled = true; },
  });
  const request = new Request('https://unused.invalid', {
    method: 'POST', body: stream, duplex: 'half',
  });
  await assert.rejects(() => readBodyBounded(request), /payload_too_large/);
  assert.equal(cancelCalled, true);
  const claimedHuge = new Request('https://unused.invalid', {
    method: 'POST', body: '{}', headers: { 'content-length': '999999' },
  });
  await assert.rejects(() => readBodyBounded(claimedHuge), /payload_too_large/);
  const ok = new Request('https://unused.invalid', { method: 'POST', body: '{"valid":true}' });
  assert.deepEqual(JSON.parse(await readBodyBounded(ok)), { valid: true });
  const invalid = new Request('https://unused.invalid', {
    method: 'POST', body: new Uint8Array([0xff, 0xfe]),
  });
  await assert.rejects(() => readBodyBounded(invalid), /invalid_json/);
});

test('real Edge handler returns 409 for cross-intent replay without writing or emailing', async (t) => {
  const previousDeno = globalThis.Deno;
  const previousFetch = globalThis.fetch;
  let handler;
  let calls = [];
  let stored = { ...prior };
  let insertRace = false;
  const env = {
    SUPABASE_URL: 'https://test-project.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_fixture',
    RESEND_API_KEY: 'fixture_only',
    PUBLIC_INTAKE_RATE_LIMIT_SALT: 'x'.repeat(32),
  };
  globalThis.Deno = {
    serve: (fn) => { handler = fn; },
    env: { get: (key) => env[key] ?? '' },
  };
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = init.method || 'GET';
    calls.push({ url, method });
    if (url.includes('/rest/v1/public_inquiries') && method === 'GET') {
      return new Response(JSON.stringify(stored ? [stored] : []), { status: 200 });
    }
    if (url.includes('/rpc/consume_public_intake_quota')) {
      return new Response('true', { status: 200 });
    }
    if (url.includes('/rest/v1/public_inquiries') && method === 'POST' && insertRace) {
      stored = { ...prior, email: 'other@example.com' };
      return new Response('{}', { status: 409 });
    }
    throw new Error('unexpected mock network request ' + method + ' ' + url);
  };
  t.after(() => {
    if (previousDeno === undefined) delete globalThis.Deno;
    else globalThis.Deno = previousDeno;
    globalThis.fetch = previousFetch;
  });
  await import('../supabase/functions/public-intake/index.ts');
  assert.equal(typeof handler, 'function');

  const same = await handler(intakeRequest(payload()));
  assert.equal(same.status, 202);
  assert.equal((await same.json()).duplicate, true);
  assert.deepEqual(calls.map(({ method }) => method), ['GET']);

  for (const other of [
    payload({ email: 'attacker@example.com' }),
    payload({ company: 'Other Co' }),
    payload({ selection: { ...selection, employeeBandId: '51-200' } }),
  ]) {
    calls = [];
    const result = await handler(intakeRequest(other));
    assert.equal(result.status, 409);
    assert.equal((await result.json()).error, 'idempotency_conflict');
    assert.deepEqual(calls.map(({ method }) => method), ['GET'], 'mismatch must not consume quotas, write or email');
  }

  calls = [];
  stored = null;
  insertRace = true;
  const race = await handler(intakeRequest(payload()));
  assert.equal(race.status, 409);
  assert.equal((await race.json()).error, 'idempotency_conflict');
  assert.equal(calls.some(({url}) => url.includes('resend.com')), false, 'must not send mail');
  assert.equal(calls.filter(({method,url}) => method === 'GET' && url.includes('public_inquiries')).length, 2);

  calls = [];
  const rawOversized = new Request('https://unused.invalid/functions/v1/public-intake', {
    method: 'POST', headers: { origin: 'https://canonical.plus', 'content-type': 'application/json' },
    body: 'X'.repeat(16_385),
  });
  const oversizedResponse = await handler(rawOversized);
  assert.equal(oversizedResponse.status, 413);
  assert.deepEqual(calls, [], 'oversized admission must not access persistence or email');
});
