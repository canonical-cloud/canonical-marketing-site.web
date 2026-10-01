import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const page = await readFile(new URL("../src/pages/quote.astro", import.meta.url), "utf8");
const runtime = await readFile(new URL("../public/quote-estimator.js", import.meta.url), "utf8");
const catalog = JSON.parse(await readFile(new URL("../src/data/service-tiers.json", import.meta.url), "utf8"));
const estimator = JSON.parse(await readFile(new URL("../src/data/quote-estimator.json", import.meta.url), "utf8"));

const idsAreUnique = (items) => new Set(items.map((item) => item.id)).size === items.length;
const amountsAreSafe = (items) => items.every((item) => Number.isFinite(item.amountUsd) && item.amountUsd >= 0);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const roundMoney = (value) => Math.round(value / estimator.roundToUsd) * estimator.roundToUsd;
const calculateEstimate = ({ speedBaseUsd, standardsUsd, depthUsd, complexityUsd, organizationUsd, employeesUsd, sectorUsd }) => {
  const midpoint = clamp(
    speedBaseUsd + standardsUsd + depthUsd + complexityUsd + organizationUsd + employeesUsd + sectorUsd,
    estimator.midpointFloorUsd,
    estimator.midpointCeilingUsd,
  );
  const lower = clamp(roundMoney(midpoint * estimator.lowerFactor), estimator.estimateFloorUsd, estimator.estimateCeilingUsd);
  const upper = clamp(roundMoney(midpoint * estimator.upperFactor), lower, estimator.estimateCeilingUsd);
  return { midpoint, lower, upper };
};
const nonEmptyStandardTotals = () => {
  const totals = [];
  const combinations = 1 << estimator.standards.length;
  for (let mask = 1; mask < combinations; mask += 1) {
    let total = 0;
    for (let index = 0; index < estimator.standards.length; index += 1) {
      if ((mask & (1 << index)) !== 0) total += estimator.standards[index].amountUsd;
    }
    totals.push(total);
  }
  return totals;
};

test("public quote page reuses the canonical recurring service-tier catalog", () => {
  assert.match(page, /import catalog from '../data/service-tiers.json'/);
  assert.equal(catalog.tiers.length, 3);
  assert.deepEqual(catalog.tiers.map((tier) => tier.monthlyUsd), [2500, 7500, 20000]);
});

test("public estimator calculates locally and only transmits after explicit email submission", () => {
  assert.match(page, /No account required/);
  assert.match(page, /calculated locally/i);
  assert.match(page, /data-complete-public-quote/);
  assert.match(page, /data-quote-complete/);
  assert.match(page, /data-quote-email-form/);
  assert.match(runtime, /completedPanel.hidden = false/);
  assert.match(runtime, /const INTAKE_ENDPOINT = 'https://forms.canonical.plus/v1/intake'/);
  assert.match(runtime, /emailForm.addEventListener('submit'/);
  assert.match(runtime, /await fetch(INTAKE_ENDPOINT/);
  assert.doesNotMatch(runtime, /localStorage|sessionStorage|indexedDB|service_role|SUPABASE_SERVICE_ROLE_KEY/i);
});

test("authenticated quote workflow remains separate and carries no browser estimate in the URL", () => {
  assert.match(page, /const appQuoteUrl = 'https://app.canonical.plus/u/quote'/);
  assert.match(page, /Sign in for account workflow/);
  assert.doesNotMatch(page, /appQuoteUrl[^
]*(?:?|#)|new URL([^
]*appQuoteUrl/i);
});

test("estimator exposes seven material scope dimensions", () => {
  assert.deepEqual(estimator.speeds.map((speed) => speed.weeks), [9, 5, 3]);
  assert.ok(estimator.standards.some((standard) => standard.id === "soc2"));
  assert.ok(estimator.standards.some((standard) => standard.id === "iso27001"));
  assert.equal(estimator.deliveryDepths.length, 3);
  assert.equal(estimator.complexities.length, 3);
  assert.deepEqual(estimator.organizationTypes.map((item) => item.id), ["startup", "business", "enterprise"]);
  assert.equal(estimator.employeeBands.length, 5);
  assert.ok(estimator.sectors.length >= 6);
  assert.match(page, /data-quote-organization-type/);
  assert.match(page, /data-quote-employees/);
  assert.match(page, /data-quote-sector/);
});

test("quote estimator configuration is internally consistent and bounded", () => {
  assert.equal(estimator.schemaVersion, 2);
  assert.match(estimator.pricingRevision, /^d{4}-d{2}-d{2}-vd+$/);
  assert.match(estimator.currency, /^[A-Z]{3}$/);
  assert.ok(estimator.estimateFloorUsd >= 0);
  assert.ok(estimator.estimateCeilingUsd > estimator.estimateFloorUsd);
  assert.ok(estimator.midpointFloorUsd >= estimator.estimateFloorUsd);
  assert.ok(estimator.midpointCeilingUsd <= estimator.estimateCeilingUsd);
  assert.ok(estimator.midpointCeilingUsd >= estimator.midpointFloorUsd);
  assert.ok(Number.isFinite(estimator.roundToUsd) && estimator.roundToUsd > 0);
  assert.ok(estimator.lowerFactor > 0 && estimator.upperFactor >= estimator.lowerFactor);

  for (const items of [
    estimator.standards,
    estimator.deliveryDepths,
    estimator.complexities,
    estimator.organizationTypes,
    estimator.sectors,
  ]) {
    assert.ok(idsAreUnique(items));
    assert.ok(amountsAreSafe(items));
  }

  assert.ok(idsAreUnique(estimator.employeeBands));
  assert.equal(estimator.employeeBands[0].minEmployees, 1);
  assert.equal(estimator.employeeBands.at(-1).maxEmployees, null);
  for (let index = 1; index < estimator.employeeBands.length; index += 1) {
    assert.equal(estimator.employeeBands[index].minEmployees, estimator.employeeBands[index - 1].maxEmployees + 1);
  }
  assert.ok(amountsAreSafe(estimator.employeeBands));

  assert.ok(estimator.speeds.some((speed) => speed.weeks === estimator.defaults.speedWeeks));
  assert.ok(estimator.defaults.standardIds.length > 0);
  assert.ok(estimator.defaults.standardIds.every((id) => estimator.standards.some((standard) => standard.id === id)));
  assert.ok(estimator.deliveryDepths.some((item) => item.id === estimator.defaults.deliveryDepthId));
  assert.ok(estimator.complexities.some((item) => item.id === estimator.defaults.complexityId));
  assert.ok(estimator.organizationTypes.some((item) => item.id === estimator.defaults.organizationTypeId));
  assert.ok(estimator.sectors.some((item) => item.id === estimator.defaults.sectorId));
  assert.ok(Number.isInteger(estimator.defaults.employeeCount) && estimator.defaults.employeeCount >= 1);

  assert.equal(estimator.estimateFloorUsd, 5000);
  assert.equal(estimator.estimateCeilingUsd, 30000);
  assert.match(runtime, /clamp(roundMoney(midpoint * lowerFactor), floor, ceiling)/);
  assert.match(runtime, /clamp(roundMoney(midpoint * upperFactor), lower, ceiling)/);
});

test("Astro validates v2 config at build time and derives the no-JS fallback from the same authority", () => {
  assert.match(page, /const EXPECTED_ESTIMATOR_SCHEMA_VERSION = 2/);
  assert.match(page, /employeeBandsAreValid/);
  assert.match(page, /throw new Error('Invalid quote estimator configuration')/);
  assert.match(page, /throw new Error('Invalid quote estimator defaults')/);
  assert.match(page, /const initialRange =/);
  assert.match(page, /const initialSummary =/);
  assert.match(page, /data-pricing-revision={estimator.pricingRevision}/);
  assert.match(page, /data-quote-range>{initialRange}</strong>/);
});

test("representative low and high estimates remain bounded and ordered", () => {
  const standards = nonEmptyStandardTotals();
  const low = calculateEstimate({
    speedBaseUsd: estimator.speeds[0].baseUsd,
    standardsUsd: Math.min(...standards),
    depthUsd: estimator.deliveryDepths[0].amountUsd,
    complexityUsd: estimator.complexities[0].amountUsd,
    organizationUsd: estimator.organizationTypes[0].amountUsd,
    employeesUsd: estimator.employeeBands[0].amountUsd,
    sectorUsd: Math.min(...estimator.sectors.map((item) => item.amountUsd)),
  });
  const high = calculateEstimate({
    speedBaseUsd: estimator.speeds.at(-1).baseUsd,
    standardsUsd: Math.max(...standards),
    depthUsd: estimator.deliveryDepths.at(-1).amountUsd,
    complexityUsd: estimator.complexities.at(-1).amountUsd,
    organizationUsd: estimator.organizationTypes.at(-1).amountUsd,
    employeesUsd: estimator.employeeBands.at(-1).amountUsd,
    sectorUsd: Math.max(...estimator.sectors.map((item) => item.amountUsd)),
  });
  for (const quote of [low, high]) {
    assert.ok(quote.midpoint >= estimator.midpointFloorUsd);
    assert.ok(quote.midpoint <= estimator.midpointCeilingUsd);
    assert.ok(quote.lower >= estimator.estimateFloorUsd);
    assert.ok(quote.upper <= estimator.estimateCeilingUsd);
    assert.ok(quote.lower <= quote.upper);
  }
  assert.ok(high.midpoint >= low.midpoint);
  assert.ok(high.lower >= low.lower);
  assert.ok(high.upper >= low.upper);
});

test("higher ordered scope factors never carry a lower configured amount", () => {
  for (const items of [
    [...estimator.speeds].sort((left, right) => right.weeks - left.weeks).map((item) => ({ amountUsd: item.baseUsd })),
    estimator.deliveryDepths,
    estimator.complexities,
    estimator.organizationTypes,
    estimator.employeeBands,
  ]) {
    for (let index = 1; index < items.length; index += 1) {
      assert.ok(items[index].amountUsd >= items[index - 1].amountUsd);
    }
  }
});

test("runtime fails closed on invalid or incompatible configuration", () => {
  assert.match(runtime, /const EXPECTED_SCHEMA_VERSION = 2/);
  assert.match(runtime, /schemaVersion === EXPECTED_SCHEMA_VERSION/);
  assert.match(runtime, /employeeBandsValid/);
  assert.match(runtime, /pricedSelectValid(organizationTypeSelect)/);
  assert.match(runtime, /pricedSelectValid(sectorSelect)/);
  assert.match(runtime, /root.dataset.quoteRuntime = 'invalid'/);
  assert.match(runtime, /Estimate unavailable/);
  assert.match(runtime, /completeButton.disabled = true/);
});

test("completed quote snapshots cannot silently become stale", () => {
  assert.match(runtime, /const invalidateCompletedQuote =/);
  assert.match(runtime, /completedPanel.hidden = true/);
  assert.match(runtime, /root.addEventListener('input', handleEstimatorChange)/);
  assert.match(runtime, /root.addEventListener('change', handleEstimatorChange)/);
});

test("quote controls expose accessibility and safe-submission semantics", () => {
  assert.match(page, /aria-valuetext={defaultSpeed.label}/);
  assert.match(page, /aria-describedby="quote-standard-note quote-standard-error"/);
  assert.match(page, /data-standard-error role="alert"/);
  assert.match(runtime, /setAttribute('aria-valuetext', quote.speed.label)/);
  assert.match(runtime, /setAttribute('aria-invalid', 'true')/);
  assert.match(runtime, /prefers-reduced-motion: reduce/);
  assert.match(runtime, /credentials: 'omit'/);
  assert.match(runtime, /AbortController/);
  assert.match(page, /This form does not opt you into a marketing list/);
});

test("public marketing page embeds no privileged backend credentials", () => {
  for (const source of [page, runtime]) {
    assert.doesNotMatch(source, /service_role|SUPABASE_SERVICE|RESEND_API_KEY|NEON_DATABASE_URL|CANONICAL_INTERNAL_AUTH_TOKEN/i);
  }
});
