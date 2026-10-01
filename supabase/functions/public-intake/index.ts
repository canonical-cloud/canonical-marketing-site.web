const allowedOrigins = new Set([
  'https://canonical.plus',
  'https://www.canonical.plus',
]);

const json = (status: number, body: unknown, origin = '') =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(allowedOrigins.has(origin) ? { 'access-control-allow-origin': origin } : {}),
      'access-control-allow-headers': 'authorization, apikey, content-type',
      'access-control-allow-methods': 'POST, OPTIONS',
      'vary': 'Origin',
    },
  });

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const validEmail = (value: string) =>
  value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

Deno.serve(async (request) => {
  const origin = request.headers.get('origin') || '';
  if (request.method === 'OPTIONS') return json(204, {}, origin);
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, origin);
  if (!allowedOrigins.has(origin)) return json(403, { error: 'origin_not_allowed' }, origin);

  const length = Number(request.headers.get('content-length') || '0');
  if (length > 16_384) return json(413, { error: 'payload_too_large' }, origin);

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: 'invalid_json' }, origin);
  }

  const kind = clean(payload.kind, 20);
  const email = clean(payload.email, 320).toLowerCase();
  const company = clean(payload.company, 160);
  const source = clean(payload.source, 120);
  if (!['quote', 'contact'].includes(kind) || !validEmail(email) || company.length < 2 || !source) {
    return json(400, { error: 'invalid_request' }, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const resendKey = Deno.env.get('RESEND_API_KEY') || '';
  const from = Deno.env.get('CANONICAL_FROM_EMAIL') || 'Canonical Plus <hello@canonical.plus>';
  if (!supabaseUrl || !serviceRole || !resendKey) {
    return json(503, { error: 'service_unavailable' }, origin);
  }

  const record: Record<string, unknown> = { kind, email, company, source };
  let subject = '';
  let html = '';
  let recipients: string[] = [];
  let cc: string[] = [];
  let replyTo = email;

  if (kind === 'quote') {
    const range = payload.range as Record<string, unknown> | undefined;
    const scope = payload.scope as Record<string, unknown> | undefined;
    if (!range || !scope) return json(400, { error: 'invalid_quote' }, origin);
    const lower = Number(range.lowerUsd);
    const upper = Number(range.upperUsd);
    const currency = clean(range.currency, 3);
    if (!Number.isSafeInteger(lower) || !Number.isSafeInteger(upper) || lower < 0 || upper < lower || currency !== 'USD') {
      return json(400, { error: 'invalid_quote_range' }, origin);
    }
    const standards = Array.isArray(scope.standards) ? scope.standards.map((x) => clean(x, 80)).filter(Boolean).slice(0, 12) : [];
    const rows = [
      ['Delivery speed', clean(scope.deliverySpeed, 80)],
      ['Frameworks', standards.join(', ')],
      ['Service depth', clean(scope.serviceDepth, 80)],
      ['Complexity', clean(scope.complexity, 80)],
      ['Organization', clean(scope.organizationType, 80)],
      ['Employees', clean(scope.employeeBand, 80)],
      ['Sector', clean(scope.sector, 100)],
    ];
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c));
    subject = `Canonical Plus readiness quote for ${company}`;
    html = `<h1>Your Canonical Plus planning estimate</h1>
      <p><strong>$${lower.toLocaleString()}–$${upper.toLocaleString()} USD</strong></p>
      <table>${rows.map(([k,v]) => `<tr><td><strong>${esc(k)}</strong></td><td>${esc(v)}</td></tr>`).join('')}</table>
      <p>This is a non-binding planning range. A reviewed and signed statement of work controls final scope, deliverables, deadlines, and price.</p>
      <p>Payment plans may be available for qualifying engagements. Larger full-program readiness engagements may qualify for scoped discounts. Independent auditor or certification-body fees are itemized separately unless expressly included in writing.</p>
      <p>Questions? Reply to this email or contact hello@canonical.plus.</p>`;
    recipients = [email];
    cc = ['hello@canonical.plus'];
    record.quote_payload = { range: { lowerUsd: lower, upperUsd: upper, currency }, scope: { ...scope, standards } };
  } else {
    const name = clean(payload.name, 120);
    const topic = clean(payload.topic, 80);
    const message = clean(payload.message, 4000);
    if (name.length < 2 || message.length < 20) return json(400, { error: 'invalid_contact' }, origin);
    record.name = name;
    record.topic = topic;
    record.message = message;
    subject = `Canonical Plus inquiry: ${topic || 'general'} — ${company}`;
    html = `<h1>New canonical.plus inquiry</h1><p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Company:</strong> ${company}</p><p><strong>Topic:</strong> ${topic}</p><p>${message.replace(/\n/g, '<br>')}</p>`;
    recipients = ['hello@canonical.plus'];
  }

  const insert = await fetch(`${supabaseUrl}/rest/v1/public_inquiries`, {
    method: 'POST',
    headers: {
      apikey: serviceRole,
      authorization: `Bearer ${serviceRole}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    body: JSON.stringify(record),
  });
  if (!insert.ok) return json(503, { error: 'storage_failed' }, origin);
  const [stored] = await insert.json();

  const send = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to: recipients, cc, reply_to: replyTo, subject, html }),
  });
  const sendBody = await send.json().catch(() => ({}));
  const deliveryStatus = send.ok ? 'sent' : 'failed';

  await fetch(`${supabaseUrl}/rest/v1/public_inquiries?id=eq.${stored.id}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceRole,
      authorization: `Bearer ${serviceRole}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ delivery_status: deliveryStatus, provider_message_id: sendBody.id || null }),
  });

  if (!send.ok) return json(502, { error: 'email_failed' }, origin);
  return json(202, { accepted: true }, origin);
});
