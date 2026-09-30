import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const page = await readFile(new URL("../src/pages/quote.astro", import.meta.url), "utf8");
const runtime = await readFile(new URL("../public/quote-estimator.js", import.meta.url), "utf8");
const catalog = JSON.parse(await readFile(new URL("../src/data/service-tiers.json", import.meta.url), "utf8"));
const estimator = JSON.parse(await readFile(new URL("../src/data/quote-estimator.json", import.meta.url), "utf8"));

test("public quote page reuses the canonical recurring service-tier catalog", () => {
  assert.match(page, /import catalog from '\.\.\/data\/service-tiers\.json'/);
  assert.equal(catalog.tiers.length, 3);
  assert.deepEqual(catalog.tiers.map((tier) => tier.monthlyUsd), [2500, 7500, 20000]);
});

test("public estimator completes without authentication", () => {
  assert.match(page, /Complete quote without login/);
  assert.match(page, /No account required/);
  assert.match(page, /data-complete-public-quote/);
  assert.match(page, /data-quote-complete/);
  assert.match(page, /exists only in this page's memory/);
  assert.match(runtime, /completedPanel\.hidden = false/);
  assert.doesNotMatch(runtime, /fetch\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB/i);
});

test("login remains an optional save and continue path", () => {
  assert.match(page, /const appQuoteUrl = 'https:\/\/app\.canonical\.plus\/u\/quote'/);
  assert.match(page, /Sign in to save \/ continue/);
  assert.match(page, /Sign in to save this scope/);
});

test("estimator exposes speed, standards, service depth, and complexity", () => {
  assert.deepEqual(estimator.speeds.map((speed) => speed.weeks), [9, 5, 3]);
  assert.ok(estimator.standards.some((standard) => standard.id === "nist"));
  assert.ok(estimator.standards.some((standard) => standard.id === "iso27001"));
  assert.ok(estimator.standards.some((standard) => standard.id === "gdpr"));
  assert.ok(estimator.standards.some((standard) => standard.id === "soc2"));
  assert.equal(estimator.deliveryDepths.length, 3);
  assert.equal(estimator.complexities.length, 3);
  assert.match(page, /type="range"/);
  assert.match(page, /name="quote_standard"/);
  assert.match(page, /name="quote_delivery_depth"/);
  assert.match(page, /name="quote_complexity"/);
});

test("public estimate is bounded to the intended planning range", () => {
  assert.equal(estimator.estimateFloorUsd, 5000);
  assert.equal(estimator.estimateCeilingUsd, 15000);
  assert.match(runtime, /clamp\(roundMoney\(midpoint \* lowerFactor\), floor, ceiling\)/);
  assert.match(runtime, /clamp\(roundMoney\(midpoint \* upperFactor\), lower, ceiling\)/);
});

test("public marketing page does not embed privileged quote credentials", () => {
  assert.doesNotMatch(page, /service_role|SUPABASE_SERVICE|NEON_DATABASE_URL|CANONICAL_INTERNAL_AUTH_TOKEN/i);
  assert.doesNotMatch(runtime, /service_role|SUPABASE_SERVICE|NEON_DATABASE_URL|CANONICAL_INTERNAL_AUTH_TOKEN/i);
});
