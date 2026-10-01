import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const page = await readFile(new URL("src/pages/quote.astro", root), "utf8");
const runtime = await readFile(new URL("public/quote-estimator.js", root), "utf8");
const estimator = JSON.parse(await readFile(new URL("src/data/quote-estimator.json", root), "utf8"));

test("quote cards keep headings inside the card instead of using fieldset legends", () => {
  assert.match(page, /class="quote-control-card" role="group"/);
  assert.match(page, /<h3 id="quote-speed-title">1\. Delivery speed<\/h3>/);
  assert.doesNotMatch(page, /<fieldset|<legend/);
});

test("v2 estimator includes company stage, employee scale, and sector", () => {
  assert.equal(estimator.schemaVersion, 2);
  assert.deepEqual(estimator.companyStages.map((x) => x.id), ["startup", "business", "enterprise"]);
  assert.ok(estimator.employeeBands.length >= 5);
  assert.ok(estimator.sectors.length >= 5);
  assert.match(page, /name="quote_company_stage"/);
  assert.match(page, /name="quote_employee_band"/);
  assert.match(page, /name="quote_sector"/);
});

test("company stage and employee scale affect pricing while sector remains scoped context", () => {
  assert.ok(estimator.companyStages.every((x) => Number.isFinite(x.multiplier) && x.multiplier > 0));
  assert.ok(estimator.employeeBands.every((x) => Number.isFinite(x.amountUsd) && x.amountUsd >= 0));
  assert.ok(estimator.sectors.every((x) => x.amountUsd === 0));
  assert.match(runtime, /additive \* stageMultiplier/);
});

test("estimate remains bounded by the shared authority", () => {
  assert.equal(estimator.estimateFloorUsd, 5000);
  assert.equal(estimator.estimateCeilingUsd, 25000);
  assert.equal(estimator.midpointFloorUsd, 5500);
  assert.equal(estimator.midpointCeilingUsd, 22000);
  assert.match(runtime, /clamp\(additive \* stageMultiplier, midpointFloor, midpointCeiling\)/);
  assert.match(runtime, /clamp\(roundMoney\(midpoint \* lowerFactor\), floor, ceiling\)/);
});

test("quote delivery uses a public Supabase Edge Function without privileged browser credentials", () => {
  assert.match(page, /PUBLIC_SUPABASE_URL/);
  assert.match(page, /PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(runtime, /functions\/v1\/public-intake/);
  assert.match(runtime, /kind: 'quote'/);
  assert.match(runtime, /companyStage:/);
  assert.doesNotMatch(page + runtime, /SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|NEON_DATABASE_URL/);
});

test("quote requires a valid recipient and copies hello in user-facing disclosure", () => {
  assert.match(page, /type="email" name="quote_email"/);
  assert.match(page, /name="quote_company"[\s\S]*minlength="2"/);
  assert.match(page, /copy <strong>hello@canonical\.plus<\/strong>/);
  assert.match(page, /Payment plans and scoped engagement discounts/);
});

test("runtime fails closed when estimator configuration is invalid", () => {
  assert.match(runtime, /root\.dataset\.quoteRuntime = 'booting'/);
  assert.match(runtime, /const configurationValid =/);
  assert.match(runtime, /root\.dataset\.quoteRuntime = 'invalid'/);
  assert.match(runtime, /Estimate unavailable/);
  assert.match(runtime, /root\.dataset\.quoteRuntime = 'ready'/);
});
