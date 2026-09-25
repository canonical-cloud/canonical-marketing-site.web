import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const page = await readFile(new URL("../src/pages/quote.astro", import.meta.url), "utf8");
const catalog = JSON.parse(await readFile(new URL("../src/data/service-tiers.json", import.meta.url), "utf8"));

test("public quote page reuses the canonical service-tier catalog", () => {
  assert.match(page, /import catalog from '\.\.\/data\/service-tiers\.json'/);
  assert.equal(catalog.tiers.length, 3);
  assert.deepEqual(catalog.tiers.map((tier) => tier.monthlyUsd), [2500, 7500, 20000]);
});

test("public quote page hands off to the authenticated application quote workflow", () => {
  assert.match(page, /const appQuoteUrl = 'https:\/\/app\.canonical\.plus\/quote'/);
  assert.match(page, /Start secure quote/);
  assert.doesNotMatch(page, /service_role|SUPABASE_SERVICE|NEON_DATABASE_URL|\/v1\/quote-requests/i);
});

test("marketing page explains the secure quote scope without duplicating the form", () => {
  assert.match(page, /employee count/);
  assert.match(page, /Frameworks such as SOC 2/);
  assert.match(page, /Infrastructure and data-sensitivity categories/);
  assert.match(page, /Do not submit credentials, PHI, cardholder data, or production evidence/);
});
