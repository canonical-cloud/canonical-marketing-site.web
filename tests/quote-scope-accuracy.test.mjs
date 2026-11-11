import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import schema from '../src/data/quote-scope.json' with { type: 'json' };
import { scopeSchema as clientSchema, customScopeReason as clientReason } from '../public/quote-scope.mjs';
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
    'cloudAccountBand', 'evidenceMaturity', 'controlOwnerBand', 'dataFootprint', 'remediationLoad',
  ]);
  for (const field of schema.fields) {
    assert.match(field.name, /^quote_[a-z_]+$/);
    assert.equal(new Set(field.options.map((option) => option.id)).size, field.options.length);
    assert.ok(field.options.some((option) => option.id === field.defaultId));
    assert.ok(field.options.every((option) => !('amountUsd' in option) && !('multiplier' in option)));
  }
  assert.equal(
    await readFile(new URL('../public/quote-scope.mjs', import.meta.url), 'utf8'),
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
  const limits = { midpointCeilingUsd: 22000, estimateCeilingUsd: 25000, upperFactor: 1.12 };
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
  assert.match(edge, /return json\(422, \{ error: 'custom_scope_required' \}, origin\)/);
  assert.match(edge, /quote\.labels\.scoping\.map/);
});
