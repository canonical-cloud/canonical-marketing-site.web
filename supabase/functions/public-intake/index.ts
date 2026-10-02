import quoteConfig from './quote-estimator.v2.mjs';

const allowedOrigins = new Set([
  'https://canonical.plus',
  'https://www.canonical.plus',
]);

const allowedContactTopics = new Map([
  ['readiness', 'Readiness / pre-audit'],
  ['remediation', 'Technical remediation'],
  ['pricing', 'Pricing / payment plans'],
  ['audit-coordination', 'Independent audit coordination'],
  ['other', 'Other'],
]);

const json = (status: number, body: unknown, origin = '', extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      'x-content-type-options': 'nosniff',
      ...(allowedOrigins.has(origin) ? { 'access-control-allow-origin': origin } : {}),
      'access-control-allow-headers': 'authorization, apikey, content-type',
      'access-control-allow-methods': 'POST, OPTIONS',
      'vary': 'Origin',
      ...extraHeaders,
    },
  });

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const cleanLine = (value: unknown, max: number) =>
  clean(value, max).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();

const validEmail = (value: string) =>
  value.length >= 3 && value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const validUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const roundMoney = (value: number) => Math.round(value / quoteConfig.roundToUsd) * quoteConfig.roundToUsd;

const itemById = <T extends { id: string }>(items: readonly T[], id: unknown): T | undefined =>
  typeof id === 'string' ? items.find((item) => item.id === id) : undefined;

const computeQuote = (raw: unknown) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('invalid_quote_selection');
  const scope = raw as Record<string, unknown>;

  const speedWeeks = Number(scope.speedWeeks);
  const speed = quoteConfig.speeds.find((item) => item.weeks === speedWeeks);
  const depth = itemById(quoteConfig.deliveryDepths, scope.deliveryDepthId);
  const complexity = itemById(quoteConfig.complexities, scope.complexityId);
  const stage = itemById(quoteConfig.companyStages, scope.companyStageId);
  const employees = itemById(quoteConfig.employeeBands, scope.employeeBandId);
  const sector = itemById(quoteConfig.sectors, scope.sectorId);

  const standardIds = Array.isArray(scope.standardIds)
    ? scope.standardIds.filter((id): id is string => typeof id === 'string')
    : [];
  const uniqueStandardIds = [...new Set(standardIds)];
  const standards = uniqueStandardIds
    .map((id) => itemById(quoteConfig.standards, id))
    .filter((item): item is (typeof quoteConfig.standards)[number] => Boolean(item));

  if (
    !speed || !depth || !complexity || !stage || !employees || !sector ||
    uniqueStandardIds.length < 1 ||
    uniqueStandardIds.length !== standardIds.length ||
    standards.length !== uniqueStandardIds.length
  ) {
    throw new Error('invalid_quote_selection');
  }

  const additive =
    speed.baseUsd +
    standards.reduce((sum, item) => sum + item.amountUsd, 0) +
    depth.amountUsd +
    complexity.amountUsd +
    employees.amountUsd +
    sector.amountUsd;

  const midpoint = clamp(
    additive * stage.multiplier,
    quoteConfig.midpointFloorUsd,
    quoteConfig.midpointCeilingUsd,
  );
  const lowerUsd = clamp(
    roundMoney(midpoint * quoteConfig.lowerFactor),
    quoteConfig.estimateFloorUsd,
    quoteConfig.estimateCeilingUsd,
  );
  const upperUsd = clamp(
    roundMoney(midpoint * quoteConfig.upperFactor),
    lowerUsd,
    quoteConfig.estimateCeilingUsd,
  );

  const labels = {
    deliverySpeed: speed.label,
    standards: standards.map((item) => item.label),
    serviceDepth: depth.label,
    complexity: complexity.label,
    companyStage: stage.label,
    employeeBand: employees.label,
    sector: sector.label,
  };

  return {
    selection: {
      speedWeeks,
      standardIds: uniqueStandardIds,
      deliveryDepthId: depth.id,
      complexityId: complexity.id,
      companyStageId: stage.id,
      employeeBandId: employees.id,
      sectorId: sector.id,
    },
    labels,
    range: { lowerUsd, upperUsd, currency: quoteConfig.currency },
    summary: [
      labels.deliverySpeed,
      labels.standards.join(' + '),
      labels.serviceDepth,
      labels.complexity,
      labels.companyStage,
      labels.employeeBand,
      labels.sector,
    ].join(' · '),
  };
};

const sha256Hex = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const consumeQuota = async (
  supabaseUrl: string,
  serviceRole: string,
  key: string,
  windowSeconds: number,
  limit: number,
) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_public_intake_quota`, {
    method: 'POST',
    headers: {
      apikey: serviceRole,
      authorization: `Bearer ${serviceRole}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      p_key: key,
      p_window_seconds: windowSeconds,
      p_limit: limit,
    }),
  });
  if (!response.ok) throw new Error('quota_backend_failed');
  return (await response.json()) === true;
};

const existingSubmission = async (
  supabaseUrl: string,
  serviceRole: string,
  idempotencyKey: string,
) => {
  const url = new URL(`${supabaseUrl}/rest/v1/public_inquiries`);
  url.searchParams.set('select', 'id,delivery_status');
  url.searchParams.set('idempotency_key', `eq.${idempotencyKey}`);
  url.searchParams.set('limit', '1');
  const response = await fetch(url, {
    headers: {
      apikey: serviceRole,
      authorization: `Bearer ${serviceRole}`,
    },
  });
  if (!response.ok) throw new Error('idempotency_backend_failed');
  const rows = await response.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
};

Deno.serve(async (request) => {
  const origin = request.headers.get('origin') || '';

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: allowedOrigins.has(origin) ? 204 : 403,
      headers: {
        ...(allowedOrigins.has(origin) ? { 'access-control-allow-origin': origin } : {}),
        'access-control-allow-headers': 'authorization, apikey, content-type',
        'access-control-allow-methods': 'POST, OPTIONS',
        'vary': 'Origin',
      },
    });
  }
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, origin);
  if (!allowedOrigins.has(origin)) return json(403, { error: 'origin_not_allowed' }, origin);

  const contentType = request.headers.get('content-type') || '';
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return json(415, { error: 'unsupported_media_type' }, origin);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 16_384) {
    return json(413, { error: 'payload_too_large' }, origin);
  }

  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not_object');
    payload = parsed as Record<string, unknown>;
  } catch {
    return json(400, { error: 'invalid_json' }, origin);
  }

  // Honeypot: accept bot submissions without creating records or sending mail.
  if (clean(payload.website, 256)) return json(202, { accepted: true }, origin);

  const kind = cleanLine(payload.kind, 20);
  const email = cleanLine(payload.email, 320).toLowerCase();
  const company = cleanLine(payload.company, 160);
  const source = cleanLine(payload.source, 120);
  const idempotencyKey = cleanLine(payload.idempotencyKey, 80);
  const expectedSource = kind === 'quote' ? 'canonical.plus/quote' : kind === 'contact' ? 'canonical.plus/contact' : '';

  if (
    !expectedSource ||
    source !== expectedSource ||
    !validEmail(email) ||
    company.length < 2 ||
    !validUuid(idempotencyKey)
  ) {
    return json(400, { error: 'invalid_request' }, origin);
  }

  let quote: ReturnType<typeof computeQuote> | null = null;
  if (kind === 'quote') {
    try {
      quote = computeQuote(payload.selection);
    } catch {
      return json(400, { error: 'invalid_quote_selection' }, origin);
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const resendKey = Deno.env.get('RESEND_API_KEY') || '';
  const rateSalt = Deno.env.get('PUBLIC_INTAKE_RATE_LIMIT_SALT') || '';
  const from = Deno.env.get('CANONICAL_FROM_EMAIL') || 'Canonical Plus <hello@canonical.plus>';
  if (!supabaseUrl || !serviceRole || !resendKey || rateSalt.length < 24) {
    return json(503, { error: 'service_unavailable' }, origin);
  }

  try {
    const prior = await existingSubmission(supabaseUrl, serviceRole, idempotencyKey);
    if (prior) {
      return json(202, {
        accepted: true,
        duplicate: true,
        ...(quote ? { quote: { range: quote.range, summary: quote.summary } } : {}),
      }, origin);
    }

    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const clientIp = request.headers.get('cf-connecting-ip')?.trim() || forwarded || 'unknown';
    const [emailHash, ipHash, globalHash] = await Promise.all([
      sha256Hex(`${rateSalt}:email:${email}`),
      sha256Hex(`${rateSalt}:ip:${clientIp}`),
      sha256Hex(`${rateSalt}:global`),
    ]);

    const quotas = await Promise.all([
      consumeQuota(supabaseUrl, serviceRole, `email:${emailHash}`, 3600, 3),
      consumeQuota(supabaseUrl, serviceRole, `ip:${ipHash}`, 600, 6),
      consumeQuota(supabaseUrl, serviceRole, `global:${globalHash}`, 3600, 200),
    ]);
    if (quotas.some((allowed) => !allowed)) {
      return json(429, { error: 'rate_limited' }, origin, { 'retry-after': '600' });
    }
  } catch {
    return json(503, { error: 'abuse_protection_unavailable' }, origin);
  }

  const record: Record<string, unknown> = {
    kind,
    email,
    company,
    source,
    idempotency_key: idempotencyKey,
  };

  let subject = '';
  let html = '';
  let textBody = '';
  let recipients: string[] = [];
  let cc: string[] = [];
  const replyTo = email;

  if (kind === 'quote' && quote) {
    const rows = [
      ['Delivery speed', quote.labels.deliverySpeed],
      ['Frameworks', quote.labels.standards.join(', ')],
      ['Service depth', quote.labels.serviceDepth],
      ['Complexity', quote.labels.complexity],
      ['Company stage', quote.labels.companyStage],
      ['Employees', quote.labels.employeeBand],
      ['Sector', quote.labels.sector],
    ];
    subject = `Canonical Plus readiness quote for ${company}`;
    html = `<h1>Your Canonical Plus planning estimate</h1>
      <p><strong>$${quote.range.lowerUsd.toLocaleString()}–$${quote.range.upperUsd.toLocaleString()} USD</strong></p>
      <table>${rows.map(([k,v]) => `<tr><td><strong>${escapeHtml(k)}</strong></td><td>${escapeHtml(v)}</td></tr>`).join('')}</table>
      <p>This is a non-binding planning range. A reviewed and signed statement of work controls final scope, deliverables, deadlines, and price.</p>
      <p>Payment plans may be available for qualifying engagements. Larger full-program readiness engagements may qualify for scoped discounts. Independent auditor or certification-body fees are itemized separately unless expressly included in writing.</p>
      <p>Questions? Reply to this email or contact hello@canonical.plus.</p>`;
    textBody = [
      'Your Canonical Plus planning estimate',
      `$${quote.range.lowerUsd.toLocaleString()}–$${quote.range.upperUsd.toLocaleString()} USD`,
      ...rows.map(([key, value]) => `${key}: ${value}`),
      '',
      'This is a non-binding planning range. A reviewed and signed statement of work controls final scope, deliverables, deadlines, and price.',
      'Questions? Reply to this email or contact hello@canonical.plus.',
    ].join('\n');
    recipients = [email];
    cc = ['hello@canonical.plus'];
    record.quote_payload = quote;
  } else {
    const name = cleanLine(payload.name, 120);
    const topic = cleanLine(payload.topic, 80);
    const message = clean(payload.message, 4000);
    const topicLabel = allowedContactTopics.get(topic);
    if (name.length < 2 || message.length < 20 || !topicLabel) {
      return json(400, { error: 'invalid_contact' }, origin);
    }
    record.name = name;
    record.topic = topic;
    record.message = message;
    subject = `Canonical Plus inquiry: ${topicLabel} — ${company}`;
    html = `<h1>New canonical.plus inquiry</h1><p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Company:</strong> ${escapeHtml(company)}</p><p><strong>Topic:</strong> ${escapeHtml(topicLabel)}</p><p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`;
    textBody = `New canonical.plus inquiry\nName: ${name}\nEmail: ${email}\nCompany: ${company}\nTopic: ${topicLabel}\n\n${message}`;
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
  if (insert.status === 409) {
    return json(202, {
      accepted: true,
      duplicate: true,
      ...(quote ? { quote: { range: quote.range, summary: quote.summary } } : {}),
    }, origin);
  }
  if (!insert.ok) return json(503, { error: 'storage_failed' }, origin);
  const [stored] = await insert.json();

  const send = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${resendKey}`,
      'content-type': 'application/json',
      'idempotency-key': `public-intake/${idempotencyKey}`,
    },
    body: JSON.stringify({
      from,
      to: recipients,
      cc,
      reply_to: replyTo,
      subject,
      html,
      text: textBody,
    }),
  });
  const sendBody = await send.json().catch(() => ({}));
  const deliveryStatus = send.ok ? 'sent' : 'failed';

  const patch = await fetch(`${supabaseUrl}/rest/v1/public_inquiries?id=eq.${stored.id}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceRole,
      authorization: `Bearer ${serviceRole}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      delivery_status: deliveryStatus,
      provider_message_id: typeof sendBody.id === 'string' ? sendBody.id.slice(0, 256) : null,
    }),
  });
  if (!patch.ok) console.error('public-intake delivery status update failed');

  if (!send.ok) return json(502, { error: 'email_failed' }, origin);
  return json(202, {
    accepted: true,
    ...(quote ? { quote: { range: quote.range, summary: quote.summary } } : {}),
  }, origin);
});
