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

test("public quote submission is idempotent and server mediated", () => {
  assert.match(page, /crypto\.randomUUID\(\)/);
  assert.match(page, /idempotency-key/);
  assert.match(page, /https:\/\/api\.canonical\.plus/);
  assert.match(page, /\/v1\/quote-requests/);
  assert.doesNotMatch(page, /service_role|SUPABASE_SERVICE|NEON_DATABASE_URL/i);
});

test("signed-in continuation has a stable app quote URL", () => {
  assert.match(page, /https:\/\/app\.canonical\.plus\/quote/);
});
