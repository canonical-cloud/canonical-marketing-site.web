import assert from 'node:assert/strict';
import { test } from 'node:test';
import scopeSchema from '../src/data/quote-scope.json' with { type: 'json' };

const qualifiedScope = Object.fromEntries(
  scopeSchema.fields.map(({ key, defaultId }) => [key, defaultId]),
);
const selection = {
  speedWeeks: 5,
  standardIds: ['soc2', 'iso27001'],
  deliveryDepthId: 'managed',
  complexityId: 'growing',
  companyStageId: 'business',
  employeeBandId: '11-50',
  sectorId: 'technology',
  scope: qualifiedScope,
};

test('actual public-intake handler sends buyer quotes with Canonical Reply-To and contacts with requester Reply-To', async (t) => {
  const oldDeno = globalThis.Deno;
  const oldFetch = globalThis.fetch;
  let handler;
  const messages = [];
  const calls = [];
  const env = {
    SUPABASE_URL: 'https://fixture-project.supabase.co',
    SUPABASE_SECRET_KEY: 'fixture-secret-not-production',
    RESEND_API_KEY: 'fixture-resend-not-production',
    PUBLIC_INTAKE_RATE_LIMIT_SALT: 'fixture-unique-salt-value-for-tests',
    CANONICAL_FROM_EMAIL: 'Canonical Plus <hello@canonical.plus>',
  };
  globalThis.Deno = {
    serve: (fn) => { handler = fn; },
    env: { get: (name) => env[name] || '' },
  };
  const json = (value, status = 200) => new Response(JSON.stringify(value), {
    status, headers: { 'content-type': 'application/json' },
  });
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = init.method || 'GET';
    calls.push({ url: url.toString(), method });
    if (url.pathname === '/rest/v1/public_inquiries' && method === 'GET') return json([]);
    if (url.pathname === '/rest/v1/rpc/consume_public_intake_quota' && method === 'POST') return json(true);
    if (url.pathname === '/rest/v1/public_inquiries' && method === 'POST') {
      const stored = JSON.parse(init.body);
      assert.ok(['quote', 'contact'].includes(stored.kind));
      return json([{ id: '123e4567-e89b-42d3-a456-426614174001' }], 201);
    }
    if (url.href === 'https://api.resend.com/emails' && method === 'POST') {
      const msg = JSON.parse(init.body);
      messages.push(msg);
      assert.match(init.headers['idempotency-key'], /^public-intake\//);
      return json({ id: 'fixture-mail-id' });
    }
    if (url.pathname === '/rest/v1/public_inquiries' && method === 'PATCH') return json([]);
    throw new Error('unexpected network call: ' + method + ' ' + url.toString());
  };
  t.after(() => {
    if (oldDeno === undefined) delete globalThis.Deno;
    else globalThis.Deno = oldDeno;
    globalThis.fetch = oldFetch;
  });

  // Actual TypeScript Edge handler; not a mocked mail-routing implementation.
  await import('../supabase/functions/public-intake/index.ts');
  assert.equal(typeof handler, 'function');

  const send = async (payload) => {
    const result = await handler(new Request(
      'https://fixture-project.supabase.co/functions/v1/public-intake', {
        method: 'POST',
        headers: {
          origin: 'https://canonical.plus',
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    ));
    assert.equal(result.status, 202, JSON.stringify(await result.clone().json()));
    assert.equal((await result.json()).accepted, true);
  };

  const quoteEmail = 'buyer@example.com';
  await send({
    kind: 'quote', source: 'canonical.plus/quote',
    email: quoteEmail, company: 'Example Co',
    idempotencyKey: '123e4567-e89b-42d3-a456-426614174000',
    selection,
  });
  assert.equal(messages.length, 1);
  assert.deepEqual(messages[0].to, [quoteEmail]);
  assert.deepEqual(messages[0].cc, ['hello@canonical.plus']);
  assert.equal(messages[0].reply_to, 'hello@canonical.plus',
    'the buyer must not be made to reply to themselves');
  assert.match(messages[0].html, /non-binding one-time project planning range/);
  assert.match(messages[0].text, /third-party testing, recurring platform subscriptions/);

  const contactEmail = 'prospect@example.com';
  await send({
    kind: 'contact', source: 'canonical.plus/contact',
    email: contactEmail, company: 'Prospect Co', name: 'Pat Prospect',
    topic: 'readiness',
    message: 'Please schedule a call about our SOC 2 readiness project.',
    idempotencyKey: '123e4567-e89b-42d3-a456-426614174002',
  });
  assert.equal(messages.length, 2);
  assert.deepEqual(messages[1].to, ['hello@canonical.plus']);
  assert.deepEqual(messages[1].cc, []);
  assert.equal(messages[1].reply_to, contactEmail,
    'the sales inbox must be able to reply to the prospect');
  assert.equal(calls.filter(({ url }) => url === 'https://api.resend.com/emails').length, 2);
});
