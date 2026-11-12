import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import schema from '../src/data/quote-scope.json' with { type: 'json' };
import { scopeSchema as clientSchema, customScopeReason as clientReason } from '../public/quote-scope.js';
import { scopeSchema as serverSchema, customScopeReason as serverReason } from '../supabase/functions/public-intake/quote-scope.mjs';
import { computeQuote } from '../supabase/functions/public-intake/quote-engine.mjs';

const validSelection = {
  speedWeeks: 5,
  standardIds: ['soc2', 'iso27001'],
  deliveryDepthId: 'managed',
  complexityId: 'growing',
  companyStageId: 'business',
  employeeBandId: '11-50',
  sectorId: 'technology',
};
const standardScope = Object.fromEntries(schema.fields.map((field) => [field.key, field.defaultId]));
const qualified = (changes = {}, scope = standardScope) => ({
  ...validSelection, ...changes, scope,
});

test('client, page and authoritative edge share the exact scope taxonomy', async () => {
  assert.deepEqual(clientSchema, schema);
  assert.deepEqual(serverSchema, schema);
  assert.equal(schema.scopeSchemaVersion, 1);
  assert.deepEqual(schema.fields.map((field) => field.key), [
    'cloudAccountBand', 'productionSystems', 'evidenceMaturity', 'controlOwnerBand', 'dataFootprint', 'dataExposure', 'remediationLoad',
  ]);
  for (const field of schema.fields) {
    assert.match(field.name, /^quote_[a-z_]+$/);
    assert.equal(new Set(field.options.map((option) => option.id)).size, field.options.length);
    assert.ok(field.options.some((option) => option.id === field.defaultId));
    assert.ok(field.options.every((option) => !('amountUsd' in option) && !('multiplier' in option)));
  }
  assert.equal(
    await readFile(new URL('../public/quote-scope.js', import.meta.url), 'utf8'),
    await readFile(new URL('../supabase/functions/public-intake/quote-scope.mjs', import.meta.url), 'utf8'),
  );
});

test('ordinary quote remains calibrated to the pinned v2 authority and carries scope details', () => {
  const legacy = computeQuote(validSelection);
  const withScope = computeQuote(qualified());
  assert.deepEqual(legacy.range, { lowerUsd: 10000, upperUsd: 12500, currency: 'USD' });
  assert.deepEqual(withScope.range, legacy.range);
  assert.deepEqual(withScope.selection.scope, standardScope);
  assert.equal(withScope.labels.scoping.length, schema.fields.length);
  assert.equal(withScope.scopeSchemaVersion, 1);
  assert.equal(legacy.scopeSchemaVersion, null);
  assert.deepEqual(legacy.labels.scoping, []);
});

test('scoping answers never silently invent extra numeric charges', () => {
  for (const [key, value] of [
    ['cloudAccountBand','3-10'],
    ['productionSystems','one'],
    ['dataExposure','sensitive'],
    ['evidenceMaturity','organized'],
    ['controlOwnerBand','6-20'],
    ['dataFootprint','multi'],
    ['remediationLoad','light'],
  ]) {
    assert.deepEqual(computeQuote(qualified({}, { ...standardScope, [key]: value })).range, computeQuote(validSelection).range, key);
  }
});

test('fail closed for federal authorization and unbounded or uncertain work', () => {
  const custom = [
    qualified({ standardIds: ['soc2', 'fedramp'] }),
    qualified({}, { ...standardScope, cloudAccountBand: '11-plus' }),
    qualified({}, { ...standardScope, productionSystems: '6-plus' }),
    qualified({}, { ...standardScope, dataExposure: 'unknown' }),
    qualified({ deliveryDepthId: 'remediation' }, { ...standardScope, dataExposure: 'regulated' }),
    qualified({ deliveryDepthId: 'managed' }, { ...standardScope, evidenceMaturity: 'early' }),
    qualified({}, { ...standardScope, controlOwnerBand: '21-plus' }),
    qualified({}, { ...standardScope, dataFootprint: 'multi-regulated' }),
    qualified({}, { ...standardScope, evidenceMaturity: 'unknown' }),
    qualified({ speedWeeks: 3 }, { ...standardScope, evidenceMaturity: 'early' }),
    qualified({ deliveryDepthId: 'remediation' }, { ...standardScope, remediationLoad: 'heavy' }),
    qualified({ employeeBandId: '1001-plus', complexityId: 'complex' }),
    qualified({
      speedWeeks: 3,
      companyStageId: 'enterprise',
      deliveryDepthId: 'remediation',
      complexityId: 'complex',
      employeeBandId: '1001-plus',
      standardIds: ['soc2','iso27001','nist','gdpr','hipaa','pci','cis'],
    }),
  ];
  for (const selection of custom) {
    assert.throws(() => computeQuote(selection), /custom_scope_required/, JSON.stringify(selection));
  }
  assert.throws(() => computeQuote({ ...validSelection, standardIds: ['fedramp'] }), /custom_scope_required/);
  assert.throws(() => computeQuote(qualified({ speedWeeks: 9, standardIds: ['soc2'], deliveryDepthId: 'advisory', complexityId: 'focused', companyStageId: 'startup', employeeBandId: '1-10' })), /custom_scope_required/, 'below-floor quote must not be padded to $5k');
});

test('malformed scoping input cannot bypass server validation', () => {
  const invalidScopes = [
    null, [], 123, {}, { ...standardScope, cloudAccountBand: '9999' },
    { ...standardScope, cloudAccountBand: 6 },
    { ...standardScope, unexpected: 'extra' },
    Object.fromEntries(Object.entries(standardScope).filter(([key]) => key !== 'dataFootprint')),
  ];
  for (const scope of invalidScopes) {
    assert.throws(() => computeQuote({ ...validSelection, scope }), /invalid_quote_selection/, JSON.stringify(scope));
  }
});

test('the browser and server use identical custom-qualification rules', () => {
  const raw = 11250;
  const limits = { midpointFloorUsd: 5500, midpointCeilingUsd: 22000, estimateFloorUsd: 5000, estimateCeilingUsd: 25000, lowerFactor: 0.9, upperFactor: 1.12 };
  for (const selection of [
    qualified(),
    qualified({ standardIds: ['fedramp'] }),
    qualified({}, { ...standardScope, remediationLoad: 'heavy' }),
    qualified({ deliveryDepthId: 'remediation' }, { ...standardScope, remediationLoad: 'heavy' }),
  ]) {
    assert.equal(clientReason(selection, raw, limits), serverReason(selection, raw, limits));
  }
  assert.match(serverReason(qualified(), 23000, limits), /published estimator range/);
  assert.match(serverReason(qualified(), 22500, limits), /published estimator range/);
  assert.match(serverReason(qualified(), 4750, limits), /published estimator range/);
  assert.match(clientReason(qualified(), 4750, limits), /published estimator range/);
});

test('UI, edge and delivery documents make qualification and pricing boundaries explicit', async () => {
  const root = new URL('../', import.meta.url);
  const [page, client, edge] = await Promise.all([
    readFile(new URL('src/pages/quote.astro', root), 'utf8'),
    readFile(new URL('public/quote-estimator.js', root), 'utf8'),
    readFile(new URL('supabase/functions/public-intake/index.ts', root), 'utf8'),
  ]);
  assert.match(page, /6\. Delivery scope and readiness/);
  assert.match(page, /data-quote-scope-field/);
  assert.match(page, /data-quote-custom-reason/);
  assert.match(page, /one-time project estimate, not a recurring monthly subscription quote/);
  assert.match(client, /quote\.requiresCustomScoping \? 'Custom scoping required'/);
  assert.match(client, /completeButton\.disabled = quote\.requiresCustomScoping/);
  assert.match(client, /selection: quote\.selection/);
  assert.match(client, /customScopeReason\(/);
  assert.match(client, /selectionRevision/);
  assert.match(client, /submittedRevision !== selectionRevision/);
  assert.match(edge, /return json\(422, \{ error: 'custom_scope_required' \}, origin\)/);
  assert.match(edge, /quote\.labels\.scoping\.map/);
});


test('actual public intake handler rejects missing scope and unsafe pricing before DB/email', async (t) => {
  const previousDeno = globalThis.Deno;
  const previousFetch = globalThis.fetch;
  let handler;
  let envReads = 0;
  let networkCalls = 0;
  globalThis.Deno = {
    serve: (fn) => { handler = fn; },
    env: { get: () => { envReads += 1; return ''; } },
  };
  globalThis.fetch = () => { networkCalls += 1; throw new Error('unexpected external call'); };
  t.after(() => {
    if (previousDeno === undefined) delete globalThis.Deno;
    else globalThis.Deno = previousDeno;
    globalThis.fetch = previousFetch;
  });

  await import('../supabase/functions/public-intake/index.ts');
  assert.equal(typeof handler, 'function', 'the real TypeScript Edge handler must be loaded');

  const payload = (selection) => ({
    kind: 'quote', source: 'canonical.plus/quote',
    email: 'fixture@example.invalid', company: 'Fixture Co',
    idempotencyKey: '123e4567-e89b-42d3-a456-426614174000',
    selection,
  });
  const request = (selection) => new Request('https://unused.invalid/functions/v1/public-intake', {
    method: 'POST',
    headers: { origin: 'https://canonical.plus', 'content-type': 'application/json' },
    body: JSON.stringify(payload(selection)),
  });
  for (const [selection, status, reason] of [
    [validSelection, 422, 'legacy client without scope'],
    [{ ...validSelection, scope: { ...standardScope, productionSystems: '6-plus' } }, 422, 'large scope'],
    [{ ...validSelection, scope: { ...standardScope, controlOwnerBand: 'unknown' } }, 422, 'unknown scope'],
    [{ ...validSelection, scope: standardScope, standardIds: ['fedramp'] }, 422, 'federal scope'],
    [{ ...validSelection, scope: standardScope, speedWeeks: 9, standardIds: ['soc2'], deliveryDepthId: 'advisory', complexityId: 'focused', companyStageId: 'startup', employeeBandId: '1-10' }, 422, 'below-floor price'],
    [{ ...validSelection, scope: null }, 400, 'invalid scope'],
    [{ ...validSelection, scope: { ...standardScope, random: 'field' } }, 400, 'injected field'],
  ]) {
    const response = await handler(request(selection));
    assert.equal(response.status, status, reason);
    assert.equal((await response.json()).error, status === 422 ? 'custom_scope_required' : 'invalid_quote_selection', reason);
    assert.equal(envReads, 0, reason + ' must not read service credentials');
    assert.equal(networkCalls, 0, reason + ' must not invoke persistence or email');
  }

  const routine = await handler(request({ ...validSelection, scope: standardScope }));
  assert.equal(routine.status, 503, 'valid scoped quote reaches service availability check');
  assert.ok(envReads > 0);
  assert.equal(networkCalls, 0, 'no real network or email is used by this test');
});
