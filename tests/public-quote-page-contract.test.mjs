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
const calculateEstimate = ({ speedBaseUsd, standardsUsd, depthUsd, complexityUsd }) => {
  const midpoint = clamp(
    speedBaseUsd + standardsUsd + depthUsd + complexityUsd,
    estimator.midpointFloorUsd,
    estimator.midpointCeilingUsd,
  );
  const lower = clamp(
    roundMoney(midpoint * estimator.lowerFactor),
    estimator.estimateFloorUsd,
    estimator.estimateCeilingUsd,
  );
  const upper = clamp(
    roundMoney(midpoint * estimator.upperFactor),
    lower,
    estimator.estimateCeilingUsd,
  );
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
  assert.match(page, /import catalog from '\.\.\/data\/service-tiers\.json'/);
  assert.equal(catalog.tiers.length, 3);
  assert.deepEqual(catalog.tiers.map((tier) => tier.monthlyUsd), [2500, 7500, 20000]);
});

test("public estimator completes without authentication or browser persistence", () => {
  assert.match(page, /Complete quote without login/);
  assert.match(page, /No account required/);
  assert.match(page, /data-complete-public-quote/);
  assert.match(page, /data-quote-complete/);
  assert.match(page, /stays in page memory and is not sent to Canonical Plus/);
  assert.match(runtime, /completedPanel\.hidden = false/);
  assert.doesNotMatch(runtime, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|localStorage|sessionStorage|indexedDB/i);
});

test("authenticated quote workflow is explicitly separate and carries no estimator state", () => {
  assert.match(page, /const appQuoteUrl = 'https:\/\/app\.canonical\.plus\/u\/quote'/);
  assert.match(page, /Signing in starts the separate account quote workflow; this browser estimate is not automatically transferred/);
  assert.match(page, />Sign in<\/a>/);
  assert.match(page, /Sign in for account quote/);
  assert.doesNotMatch(page, /save this scope|save \/ continue/i);
  assert.doesNotMatch(page, /appQuoteUrl[^\n]*(?:\?|#)|new URL\([^\n]*appQuoteUrl/i);
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

test("quote estimator configuration is internally consistent and bounded", () => {
  assert.equal(estimator.schemaVersion, 1);
  assert.match(estimator.currency, /^[A-Z]{3}$/);
  assert.ok(Number.isFinite(estimator.estimateFloorUsd));
  assert.ok(Number.isFinite(estimator.estimateCeilingUsd));
  assert.ok(estimator.estimateFloorUsd >= 0);
  assert.ok(estimator.estimateCeilingUsd > estimator.estimateFloorUsd);
  assert.ok(estimator.midpointFloorUsd >= estimator.estimateFloorUsd);
  assert.ok(estimator.midpointCeilingUsd <= estimator.estimateCeilingUsd);
  assert.ok(estimator.midpointCeilingUsd >= estimator.midpointFloorUsd);
  assert.ok(Number.isFinite(estimator.roundToUsd) && estimator.roundToUsd > 0);
  assert.ok(estimator.lowerFactor > 0 && estimator.upperFactor >= estimator.lowerFactor);

  assert.ok(estimator.speeds.length > 0);
  assert.equal(new Set(estimator.speeds.map((speed) => speed.weeks)).size, estimator.speeds.length);
  assert.ok(estimator.speeds.every((speed) => Number.isInteger(speed.weeks) && speed.weeks > 0));
  assert.ok(estimator.speeds.every((speed) => Number.isFinite(speed.baseUsd) && speed.baseUsd >= 0));
  assert.ok(idsAreUnique(estimator.standards));
  assert.ok(idsAreUnique(estimator.deliveryDepths));
  assert.ok(idsAreUnique(estimator.complexities));
  assert.ok(amountsAreSafe(estimator.standards));
  assert.ok(amountsAreSafe(estimator.deliveryDepths));
  assert.ok(amountsAreSafe(estimator.complexities));

  assert.ok(estimator.speeds.some((speed) => speed.weeks === estimator.defaults.speedWeeks));
  assert.ok(estimator.defaults.standardIds.length > 0);
  assert.ok(estimator.defaults.standardIds.every((id) => estimator.standards.some((standard) => standard.id === id)));
  assert.ok(estimator.deliveryDepths.some((item) => item.id === estimator.defaults.deliveryDepthId));
  assert.ok(estimator.complexities.some((item) => item.id === estimator.defaults.complexityId));

  assert.equal(estimator.estimateFloorUsd, 5000);
  assert.equal(estimator.estimateCeilingUsd, 15000);
  assert.match(runtime, /clamp\(roundMoney\(midpoint \* lowerFactor\), floor, ceiling\)/);
  assert.match(runtime, /clamp\(roundMoney\(midpoint \* upperFactor\), lower, ceiling\)/);
});

test("Astro validates config at build time and derives the no-JS fallback from the same authority", () => {
  assert.match(page, /const EXPECTED_ESTIMATOR_SCHEMA_VERSION = 1/);
  assert.match(page, /throw new Error\('Invalid quote estimator configuration'\)/);
  assert.match(page, /throw new Error\('Invalid quote estimator defaults'\)/);
  assert.match(page, /const initialRange =/);
  assert.match(page, /const initialSummary =/);
  assert.match(page, /data-schema-version=\{estimator\.schemaVersion\}/);
  assert.match(page, /data-quote-range>\{initialRange\}<\/strong>/);
  assert.match(page, /data-quote-summary>\{initialSummary\}<\/p>/);
  assert.doesNotMatch(page, /data-quote-range>\$[0-9]/);
});

test("every supported pricing combination stays bounded and ordered", () => {
  const standardTotals = nonEmptyStandardTotals();
  let combinationsChecked = 0;

  for (const speed of estimator.speeds) {
    for (const standardsUsd of standardTotals) {
      for (const depth of estimator.deliveryDepths) {
        for (const complexity of estimator.complexities) {
          const quote = calculateEstimate({
            speedBaseUsd: speed.baseUsd,
            standardsUsd,
            depthUsd: depth.amountUsd,
            complexityUsd: complexity.amountUsd,
          });
          assert.ok(quote.midpoint >= estimator.midpointFloorUsd);
          assert.ok(quote.midpoint <= estimator.midpointCeilingUsd);
          assert.ok(quote.lower >= estimator.estimateFloorUsd);
          assert.ok(quote.upper <= estimator.estimateCeilingUsd);
          assert.ok(quote.lower <= quote.upper);
          combinationsChecked += 1;
        }
      }
    }
  }

  assert.equal(
    combinationsChecked,
    (2 ** estimator.standards.length - 1) * estimator.speeds.length * estimator.deliveryDepths.length * estimator.complexities.length,
  );
});

test("faster delivery, deeper service, and greater complexity never reduce pricing", () => {
  const standardTotals = nonEmptyStandardTotals();
  const orderedSpeeds = [...estimator.speeds].sort((left, right) => right.weeks - left.weeks);
  const orderedDepths = estimator.deliveryDepths;
  const orderedComplexities = estimator.complexities;

  for (let index = 1; index < orderedSpeeds.length; index += 1) {
    assert.ok(orderedSpeeds[index].weeks < orderedSpeeds[index - 1].weeks);
    assert.ok(orderedSpeeds[index].baseUsd >= orderedSpeeds[index - 1].baseUsd);
  }
  for (let index = 1; index < orderedDepths.length; index += 1) {
    assert.ok(orderedDepths[index].amountUsd >= orderedDepths[index - 1].amountUsd);
  }
  for (let index = 1; index < orderedComplexities.length; index += 1) {
    assert.ok(orderedComplexities[index].amountUsd >= orderedComplexities[index - 1].amountUsd);
  }

  for (const standardsUsd of standardTotals) {
    for (const depth of orderedDepths) {
      for (const complexity of orderedComplexities) {
        const quotes = orderedSpeeds.map((speed) => calculateEstimate({
          speedBaseUsd: speed.baseUsd,
          standardsUsd,
          depthUsd: depth.amountUsd,
          complexityUsd: complexity.amountUsd,
        }));
        for (let index = 1; index < quotes.length; index += 1) {
          assert.ok(quotes[index].midpoint >= quotes[index - 1].midpoint);
          assert.ok(quotes[index].lower >= quotes[index - 1].lower);
          assert.ok(quotes[index].upper >= quotes[index - 1].upper);
        }
      }
    }
  }
});

test("runtime fails closed on invalid or incompatible configuration instead of substituting pricing defaults", () => {
  assert.match(runtime, /const EXPECTED_SCHEMA_VERSION = 1/);
  assert.match(runtime, /schemaVersion === EXPECTED_SCHEMA_VERSION/);
  assert.match(runtime, /const configurationValid =/);
  assert.match(runtime, /\^\[A-Z\]\{3\}\$/);
  assert.match(runtime, /Number\.isFinite\(floor\)/);
  assert.match(runtime, /uniqueIndexes\.size === speedOptions\.length/);
  assert.match(runtime, /pricedInputs\.every\(pricedInputValid\)/);
  assert.match(runtime, /root\.dataset\.quoteRuntime = 'invalid'/);
  assert.match(runtime, /Estimate unavailable/);
  assert.match(runtime, /completeButton\.disabled = true/);
  assert.doesNotMatch(runtime, /root\.dataset\.(?:floor|ceiling|roundTo),\s*\d/);
});

test("completed quote snapshots cannot silently become stale", () => {
  assert.match(runtime, /const invalidateCompletedQuote =/);
  assert.match(runtime, /completedPanel\.hidden = true/);
  assert.match(runtime, /root\.addEventListener\('input', handleEstimatorChange\)/);
  assert.match(runtime, /root\.addEventListener\('change', handleEstimatorChange\)/);
  assert.match(page, /Changing any input invalidates this completed snapshot/);
});

test("quote controls expose validation and reduced-motion accessibility semantics", () => {
  assert.match(page, /aria-valuetext=\{defaultSpeed\.label\}/);
  assert.match(page, /aria-describedby="quote-standard-note quote-standard-error"/);
  assert.match(page, /data-standard-error role="alert"/);
  assert.match(runtime, /setAttribute\('aria-valuetext', quote\.speed\.label\)/);
  assert.match(runtime, /setAttribute\('aria-invalid', 'true'\)/);
  assert.match(runtime, /firstStandard\.focus\(\{ preventScroll: true \}\)/);
  assert.match(runtime, /prefers-reduced-motion: reduce/);
});

test("public marketing page does not embed privileged quote credentials", () => {
  assert.doesNotMatch(page, /service_role|SUPABASE_SERVICE|NEON_DATABASE_URL|CANONICAL_INTERNAL_AUTH_TOKEN/i);
  assert.doesNotMatch(runtime, /service_role|SUPABASE_SERVICE|NEON_DATABASE_URL|CANONICAL_INTERNAL_AUTH_TOKEN/i);
});
