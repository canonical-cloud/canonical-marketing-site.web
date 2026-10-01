import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const page = await readFile(new URL("../src/pages/quote.astro", import.meta.url), "utf8");
const runtime = await readFile(new URL("../public/quote-estimator.js", import.meta.url), "utf8");
const estimator = JSON.parse(await readFile(new URL("../src/data/quote-estimator.json", import.meta.url), "utf8"));
const pin = JSON.parse(await readFile(new URL("../src/data/quote-estimator.contract.json", import.meta.url), "utf8"));

const idsAreUnique = (items) => new Set(items.map((item) => item.id)).size === items.length;
const amountsAreSafe = (items) => items.every((item) => Number.isFinite(item.amountUsd) && item.amountUsd >= 0);

test("quote estimator v2 is pinned to the shared v2 authority", () => {
  assert.equal(estimator.schemaVersion, 2);
  assert.equal(pin.schemaVersion, 2);
  assert.equal(pin.contractId, "urn:canonical-cloud:public-quote-estimator:v2");
  assert.match(pin.authorityFixturePath, /public-quote-estimator\/v2\/instances/);
  assert.match(pin.authorityRevision, /^[0-9a-f]{40}$/);
});

test("quote page adds company stage, employee count, and business sector", () => {
  assert.equal(estimator.companyStages.length, 3);
  assert.deepEqual(estimator.companyStages.map((item) => item.id), ["startup", "business", "enterprise"]);
  assert.ok(estimator.employeeBands.length >= 5);
  assert.ok(estimator.sectors.length >= 6);
  assert.match(page, /data-quote-stage/);
  assert.match(page, /data-quote-employees/);
  assert.match(page, /data-quote-sector/);
  assert.match(page, /Company stage/);
  assert.match(page, /Number of employees/);
  assert.match(page, /Business sector/);
});

test("visible card titles render inside the card instead of in the fieldset border", () => {
  assert.match(page, /<legend class="sr-only">1\. Company profile<\/legend>/);
  assert.match(page, /<h3 class="quote-control-card__title">1\. Company profile<\/h3>/);
  assert.match(page, /\.quote-control-card__title \{ margin: 0 0 1rem/);
  assert.doesNotMatch(page, /\.quote-control-card legend \{ padding:/);
});

test("quote completion sends a bounded public intake payload instead of requiring sign-in", () => {
  assert.match(page, /PUBLIC_CANONICAL_INTAKE_URL/);
  assert.match(page, /Email my estimate/);
  assert.match(page, /hello@canonical\.plus/);
  assert.match(runtime, /fetch\(intakeEndpoint/);
  assert.match(runtime, /kind: 'quote'/);
  assert.match(runtime, /company_profile:/);
  assert.match(runtime, /employee_count:/);
  assert.match(runtime, /standards:/);
  assert.match(runtime, /credentials: 'omit'/);
  assert.doesNotMatch(page, />Sign in<\/a>/);
  assert.doesNotMatch(runtime, /localStorage|sessionStorage|indexedDB/i);
});

test("public quote browser code never contains privileged backend credentials", () => {
  for (const text of [page, runtime]) {
    assert.doesNotMatch(text, /service_role|SUPABASE_SERVICE|NEON_DATABASE_URL|RESEND_API_KEY|CLOUDFLARE_TURNSTILE_SECRET|CANONICAL_INTERNAL_AUTH_TOKEN/i);
  }
});

test("estimator collections are unique, non-negative, and bounded", () => {
  assert.match(estimator.currency, /^[A-Z]{3}$/);
  assert.equal(estimator.estimateFloorUsd, 5000);
  assert.equal(estimator.estimateCeilingUsd, 25000);
  assert.ok(estimator.midpointFloorUsd >= estimator.estimateFloorUsd);
  assert.ok(estimator.midpointCeilingUsd <= estimator.estimateCeilingUsd);
  assert.ok(estimator.lowerFactor > 0 && estimator.upperFactor >= estimator.lowerFactor);

  for (const items of [estimator.standards, estimator.deliveryDepths, estimator.complexities, estimator.employeeBands, estimator.sectors]) {
    assert.ok(idsAreUnique(items));
    assert.ok(amountsAreSafe(items));
  }
  assert.ok(idsAreUnique(estimator.companyStages));
  assert.ok(estimator.companyStages.every((item) => Number.isFinite(item.multiplier) && item.multiplier > 0));
  assert.ok(estimator.employeeBands.every((band) => Number.isInteger(band.min) && Number.isInteger(band.max) && band.min <= band.max));
});

test("company scale factors are monotonic", () => {
  const stages = estimator.companyStages.map((item) => item.multiplier);
  const employeeAmounts = estimator.employeeBands.map((item) => item.amountUsd);
  for (let index = 1; index < stages.length; index += 1) assert.ok(stages[index] >= stages[index - 1]);
  for (let index = 1; index < employeeAmounts.length; index += 1) assert.ok(employeeAmounts[index] >= employeeAmounts[index - 1]);
});

test("positive readiness positioning leads while formal-role boundaries remain explicit", () => {
  assert.match(page, /Canonical Plus supports readiness and pre-audit preparation/);
  assert.match(page, /Payment plans are available for qualified engagements/);
  assert.match(page, /Bundled discounts may be available/);
  assert.match(page, /Formal audit opinions, certifications, and regulatory determinations remain with the independent provider or authority/);
  assert.doesNotMatch(page, /Readiness support is not a substitute for/i);
});

test("configuration fails closed instead of inventing quote defaults", () => {
  assert.match(page, /const EXPECTED_ESTIMATOR_SCHEMA_VERSION = 2/);
  assert.match(page, /throw new Error\('Invalid quote estimator configuration'\)/);
  assert.match(runtime, /const EXPECTED_SCHEMA_VERSION = 2/);
  assert.match(runtime, /root\.dataset\.quoteRuntime = 'invalid'/);
  assert.match(runtime, /Estimate unavailable/);
  assert.match(runtime, /completeButton\.disabled = true/);
});
