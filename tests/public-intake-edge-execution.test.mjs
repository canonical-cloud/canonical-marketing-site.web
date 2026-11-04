import assert from 'node:assert/strict';
import test from 'node:test';

// Execute the actual deployed TypeScript handler with Node's type stripping.
// No Supabase project, network, database, mail provider or credentials are used.
test('Edge Function denies FedRAMP before I/O and accepts normal quotes with mocked services', async (t) => {
  const priorDeno = globalThis.Deno;
  const priorFetch = globalThis.fetch;
  let handler;
  const envReads = [];
  const env = new Map([
    ['SUPABASE_URL', 'https://testing.supabase.co'],
    ['SUPABASE_SECRET_KEY', 'test_secret_key_not_real'],
    ['RESEND_API_KEY', 'test_resend_key_not_real'],
    ['PUBLIC_INTAKE_RATE_LIMIT_SALT', 'test-salt-not-secret-0123456789-abcdef'],
    ['CANONICAL_FROM_EMAIL', 'Canonical Plus <hello@canonical.plus>'],
  ]);
  globalThis.Deno = {
    serve: (fn) => { handler = fn; },
    env: { get: (name) => { envReads.push(name); return env.get(name) || ''; } },
  };
  t.after(() => {
    if (priorDeno === undefined) delete globalThis.Deno;
    else globalThis.Deno = priorDeno;
    globalThis.fetch = priorFetch;
  });

  await import('../supabase/functions/public-intake/index.ts');
  assert.equal(typeof handler, 'function');

  const selection = {
    speedWeeks: 5,
    standardIds: ['soc2'],
    deliveryDepthId: 'managed',
    complexityId: 'growing',
    companyStageId: 'business',
    employeeBandId: '11-50',
    sectorId: 'technology',
  };
  const validPayload = (standardIds) => ({
    kind: 'quote',
    source: 'canonical.plus/quote',
    email: 'release-fixture@example.invalid',
    company: 'Automated test organization',
    idempotencyKey: '123e4567-e89b-42d3-a456-426614174000',
    selection: { ...selection, standardIds },
  });
  const request = (payload) => new Request('https://testing.supabase.co/functions/v1/public-intake', {
    method: 'POST',
    headers: {
      origin: 'https://canonical.plus',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const head = await handler(new Request('https://testing.supabase.co/functions/v1/public-intake', {
    method: 'HEAD', headers: { origin: 'https://canonical.plus' },
  }));
  assert.equal(head.status, 204);
  assert.equal(head.headers.get('x-canonical-intake-revision'), 'unreleased');
  assert.equal(head.headers.get('x-canonical-intake-contract'), 'fedramp-custom-scope-v1');
  assert.equal(envReads.length, 0);

  const writes = [];
  globalThis.fetch = async (...args) => {
    writes.push(args);
    throw new Error('FedRAMP denial must happen before all network I/O');
  };
  for (const standards of [['fedramp'], ['soc2', 'fedramp'], ['fedramp', 'iso27001']]) {
    const rejected = await handler(request(validPayload(standards)));
    assert.equal(rejected.status, 422);
    assert.deepEqual(await rejected.json(), { error: 'custom_scope_required' });
    assert.equal(writes.length, 0, 'reject must not touch database or email');
    assert.equal(envReads.length, 0, 'reject must not even read privileged env');
  }

  const calls = [];
  const response = (data, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json' },
  });
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = init.method || 'GET';
    calls.push({ url, method });
    if (url.startsWith('https://testing.supabase.co/rest/v1/public_inquiries?') && method === 'GET') {
      return response([]);
    }
    if (url === 'https://testing.supabase.co/rest/v1/rpc/consume_public_intake_quota' && method === 'POST') {
      return response(true);
    }
    if (url === 'https://testing.supabase.co/rest/v1/public_inquiries' && method === 'POST') {
      const record = JSON.parse(init.body);
      assert.equal(record.kind, 'quote');
      assert.deepEqual(record.quote_payload.selection.standardIds, ['soc2']);
      return response([{ id: '123e4567-e89b-42d3-a456-426614174001' }], 201);
    }
    if (url === 'https://api.resend.com/emails' && method === 'POST') {
      const mail = JSON.parse(init.body);
      assert.deepEqual(mail.to, ['release-fixture@example.invalid']);
      assert.match(mail.subject, /readiness quote/);
      return response({ id: 'fixture-provider-id' });
    }
    if (url.startsWith('https://testing.supabase.co/rest/v1/public_inquiries?') && method === 'PATCH') {
      return response([]);
    }
    throw new Error('unexpected outgoing service call in fixture');
  };
  const accepted = await handler(request(validPayload(['soc2'])));
  assert.equal(accepted.status, 202);
  const result = await accepted.json();
  assert.equal(result.accepted, true);
  assert.ok(result.quote?.range?.lowerUsd > 0);
  assert.ok(result.quote?.range?.upperUsd >= result.quote.range.lowerUsd);
  assert.equal(calls.filter((c) => c.method === 'GET').length, 1);
  assert.equal(calls.filter((c) => c.url.includes('consume_public_intake_quota')).length, 3);
  assert.equal(calls.filter((c) => c.url === 'https://api.resend.com/emails').length, 1);
  assert.equal(calls.filter((c) => c.method === 'PATCH').length, 1);
});
