import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const load = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [quote, runtime, pricing, prices, compare, legal, estimator, tiers] = await Promise.all([
  load('src/pages/quote.astro'),
  load('public/quote-estimator.js'),
  load('src/pages/pricing.astro'),
  load('src/pages/prices.astro'),
  load('src/pages/compare.astro'),
  load('src/pages/legal.astro'),
  load('src/data/quote-estimator.json').then(JSON.parse),
  load('src/data/service-tiers.json').then(JSON.parse),
]);

test('federal authorization programs do not receive ordinary instant project quotes', () => {
  assert.equal(estimator.standards.find((x) => x.id === 'fedramp')?.id, 'fedramp');
  assert.match(quote, /FedRAMP readiness is custom-scoped/);
  assert.match(quote, /does not price a FedRAMP program/);
  assert.match(runtime, /const requiresCustomScoping = standards\.some\(\(input\) => input\.value === 'fedramp'\)/);
  assert.match(runtime, /quote\.requiresCustomScoping\s*\? 'Custom scoping required'/);
  assert.match(runtime, /completeButton\.disabled = quote\.requiresCustomScoping/);
  assert.match(runtime, /if \(quote\.requiresCustomScoping\) \{/);
  assert.match(runtime, /quote\.requiresCustomScoping \? 'custom-scope' : 'ready'/);
  assert.match(runtime, /completeButton\.disabled = calculate\(\)\.requiresCustomScoping/);
});

test('project quote and recurring monthly tier are different commercial models', () => {
  assert.equal(tiers.source.publicationStatus, 'proposed');
  assert.equal(estimator.currency, tiers.source.currency);
  assert.match(quote, /project estimate is not a monthly subscription quote/);
  for (const page of [pricing, prices]) {
    assert.match(page, /recurring monthly service assumptions/);
    assert.match(page, /not the one-time project estimator or fixed-fee SOW packages/);
    assert.match(page, /customer internal-labor costs/);
  }
  assert.match(quote, /independent audit testing.*third-party assessor fees.*penetration testing.*recurring platform subscriptions/s);
});

test('published comparison and legal explanations preserve auditor and privacy boundaries', () => {
  assert.match(compare, /October 30, 2026/);
  assert.match(compare, /source, observation period, coverage, and exception context/);
  assert.match(compare, /independent auditor acceptance/);
  assert.match(legal, /signed data-processing terms control customer personal-data processing/);
  assert.match(legal, /applicable signed documents/);
  assert.match(compare, /not a claim of a native integration or feature parity/);
});
