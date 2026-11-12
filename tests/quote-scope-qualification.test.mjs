import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { computeQuote } from '../supabase/functions/public-intake/quote-engine.mjs';
import { qualifyQuoteScope, scopeDefaults } from '../supabase/functions/public-intake/quote-scope.mjs';

const normal = {
  speedWeeks: 5,
  standardIds: ['soc2', 'iso27001'],
  deliveryDepthId: 'managed',
  complexityId: 'growing',
  companyStageId: 'business',
  employeeBandId: '11-50',
  sectorId: 'technology',
};
const scope = { ...scopeDefaults };

test('routine estimate is unchanged by additional qualitative questions', () => {
  const quote = computeQuote(normal);
  assert.deepEqual(quote.range, { lowerUsd: 10000, upperUsd: 12500, currency: 'USD' });
  const qualification = qualifyQuoteScope(scope, normal);
  assert.equal(qualification.requiresCustomScoping, false);
  assert.equal(qualification.labels.systemsInScope, '2–5 production systems');
  assert.equal(qualification.labels.cloudAccountBand, '1–2 cloud accounts');
  assert.equal(Object.keys(qualification.labels).length, 7);
  assert.deepEqual(computeQuote(normal).range, computeQuote({ ...normal }).range);
});

test('federal scope is never priced by the v2 engine', () => {
  assert.throws(() => computeQuote({ ...normal, standardIds: ['soc2', 'fedramp'] }), /custom_scope_required/);
  assert.equal(qualifyQuoteScope(scope, { ...normal, standardIds: ['fedramp'] }).requiresCustomScoping, true);
});

test('prices that would be clipped by a cap require a reviewed proposal', () => {
  const expansive = {
    ...normal,
    speedWeeks: 3,
    standardIds: ['soc2','iso27001','nist','gdpr','hipaa','pci','cis'],
    deliveryDepthId: 'remediation',
    complexityId: 'complex',
    companyStageId: 'enterprise',
    employeeBandId: '1001-plus',
  };
  assert.throws(() => computeQuote(expansive), /custom_scope_required/);
});

test('large, unknown and regulated remediation scopes are routed to custom scoping', () => {
  for (const changed of [
    { systemsInScope: 'six-plus' },
    { systemsInScope: 'unsure' },
    { readinessBaseline: 'unsure' },
    { dataExposure: 'unsure' },
    { readinessBaseline: 'new' },
    { cloudAccountBand: '11-plus' },
    { cloudAccountBand: 'unknown' },
    { controlOwnerBand: '21-plus' },
    { controlOwnerBand: 'unknown' },
    { dataFootprint: 'multi-regulated' },
    { dataFootprint: 'unknown' },
    { remediationLoad: 'unknown' },
  ]) {
    assert.equal(qualifyQuoteScope({ ...scope, ...changed }, normal).requiresCustomScoping, true);
  }
  assert.equal(qualifyQuoteScope({ ...scope, dataExposure: 'regulated' }, normal).requiresCustomScoping, false);
  assert.equal(qualifyQuoteScope(
    { ...scope, dataExposure: 'regulated' },
    { ...normal, deliveryDepthId: 'remediation' },
  ).requiresCustomScoping, true);
  assert.equal(qualifyQuoteScope(
    { ...scope, readinessBaseline: 'new' },
    { ...normal, deliveryDepthId: 'advisory' },
  ).requiresCustomScoping, false);
  assert.equal(qualifyQuoteScope({ ...scope, remediationLoad: 'heavy' }, normal).requiresCustomScoping, false);
  assert.equal(qualifyQuoteScope({ ...scope, remediationLoad: 'heavy' }, { ...normal, deliveryDepthId: 'remediation' }).requiresCustomScoping, true);
  assert.equal(qualifyQuoteScope({ ...scope, dataFootprint: 'multi' }, normal).requiresCustomScoping, false);
  assert.equal(qualifyQuoteScope({ ...scope, controlOwnerBand: '6-20' }, normal).requiresCustomScoping, false);
  assert.equal(qualifyQuoteScope({ ...scope, readinessBaseline: 'new' }, { ...normal, deliveryDepthId: 'advisory', speedWeeks: 3 }).requiresCustomScoping, true);
  assert.equal(qualifyQuoteScope(scope, { ...normal, companyStageId: 'enterprise', employeeBandId: '1001-plus', complexityId: 'complex' }).requiresCustomScoping, true);
});

test('unknown, missing, or injected scoping data cannot silently get a quote', () => {
  for (const invalid of [undefined, null, [], {}, { ...scope, systemsInScope: '1000' },
    { ...scope, extra: 'ignore' }, { ...scope, dataExposure: 7 },
    { ...scope, cloudAccountBand: '1000' }, { ...scope, controlOwnerBand: null },
    { ...scope, dataFootprint: 'arbitrary' }, { ...scope, remediationLoad: '<script>' }]) {
    assert.throws(() => qualifyQuoteScope(invalid, normal), /invalid_quote_scope/);
  }
});

test('the public edge rejects unsupported scope and cannot be bypassed with client pricing', async () => {
  const edge = await readFile(new URL('../supabase/functions/public-intake/index.ts', import.meta.url), 'utf8');
  assert.match(edge, /qualifyQuoteScope\(payload\.scopeContext, payload\.selection\)/);
  assert.match(edge, /return json\(422, \{ error: 'custom_scope_required' \}/);
  assert.match(edge, /quote = \{[\s\S]*\.\.\.authoritative/);
  assert.doesNotMatch(edge, /payload\.range/);
  assert.match(edge, /quote\.scope\.labels\.dataExposure/);
  assert.match(edge, /quote\.scope\.labels\.cloudAccountBand/);
  assert.match(edge, /quote\.scope\.labels\.controlOwnerBand/);
  assert.match(edge, /quote\.scope\.labels\.dataFootprint/);
  assert.match(edge, /quote\.scope\.labels\.remediationLoad/);
});

test('browser quote submission is revision-fenced against stale async completion', async () => {
  const browserRuntime = await readFile(new URL('../public/quote-estimator.js', import.meta.url), 'utf8');
  assert.match(browserRuntime, /let selectionRevision = 0/);
  assert.match(browserRuntime, /selectionRevision \+= 1/);
  assert.match(browserRuntime, /const submittedRevision = selectionRevision/);
  assert.match(browserRuntime, /if \(submittedRevision !== selectionRevision\)/);
  assert.match(browserRuntime, /completeButton\.disabled = calculate\(\)\.requiresCustomScoping/);
  assert.doesNotMatch(browserRuntime, /range:\s*\{\s*lowerUsd:/);
});

test('browser and server implement the same additional custom-qualification rules', async () => {
  const browser = await readFile(new URL('../public/quote-estimator.js', import.meta.url), 'utf8');
  const server = await readFile(new URL('../supabase/functions/public-intake/quote-scope.mjs', import.meta.url), 'utf8');
  const page = await readFile(new URL('../src/pages/quote.astro', import.meta.url), 'utf8');
  for (const [key, selector] of [
    ['cloudAccountBand', 'quote_cloud_account_band'],
    ['controlOwnerBand', 'quote_control_owner_band'],
    ['dataFootprint', 'quote_data_footprint'],
    ['remediationLoad', 'quote_remediation_load'],
  ]) {
    assert.match(browser, new RegExp(key));
    assert.match(server, new RegExp(key));
    assert.match(page, new RegExp(selector));
  }
  for (const reason of [
    'Eleven or more cloud accounts', 'More than 20 control owners',
    'Multiple regulated entities or jurisdictions', 'Substantial technical remediation',
    'Large, complex enterprise scope',
  ]) {
    assert.ok(browser.includes(reason), `browser missing ${reason}`);
    assert.ok(server.includes(reason), `server missing ${reason}`);
  }
});
