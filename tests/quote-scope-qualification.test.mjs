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
});

test('unknown, missing, or injected scoping data cannot silently get a quote', () => {
  for (const invalid of [undefined, null, [], {}, { ...scope, systemsInScope: '1000' },
    { ...scope, extra: 'ignore' }, { ...scope, dataExposure: 7 }]) {
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
