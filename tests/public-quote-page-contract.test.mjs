import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const page = await readFile(new URL("../src/pages/quote.astro", import.meta.url), "utf8");
const runtime = await readFile(new URL("../public/quote-estimator.js", import.meta.url), "utf8");
const intake = await readFile(new URL("../public/intake-form.js", import.meta.url), "utf8");
const catalog = JSON.parse(await readFile(new URL("../src/data/service-tiers.json", import.meta.url), "utf8"));
const estimator = JSON.parse(await readFile(new URL("../src/data/quote-estimator.json", import.meta.url), "utf8"));

const idsAreUnique = (items) => new Set(items.map((item) => item.id)).size === items.length;
const amountsAreSafe = (items) => items.every((item) => Number.isFinite(item.amountUsd) && item.amountUsd >= 0);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const roundMoney = (value) => Math.round(value / estimator.roundToUsd) * estimator.roundToUsd;
const calculateEstimate = ({ speedBaseUsd, standardsUsd, depthUsd, complexityUsd, scaleUsd = 0 }) => {
  const midpoint = clamp(speedBaseUsd + standardsUsd + depthUsd + complexityUsd + scaleUsd, estimator.midpointFloorUsd, estimator.midpointCeilingUsd);
  const lower = clamp(roundMoney(midpoint * estimator.lowerFactor), estimator.estimateFloorUsd, estimator.estimateCeilingUsd);
  const upper = clamp(roundMoney(midpoint * estimator.upperFactor), lower, estimator.estimateCeilingUsd);
  return { midpoint, lower, upper };
};
const nonEmptyStandardTotals = () => {
  const totals = [];
  for (let mask = 1; mask < (1 << estimator.standards.length); mask += 1) {
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

test("quote cards keep visible titles inside the card body", () => {
  assert.match(page, /class="quote-control-card__title" id="quote-speed-title">1\. Delivery speed<\/h3>/);
  assert.match(page, /<legend class="sr-only">Standards to meet<\/legend>/);
  assert.match(page, /<h3 class="quote-control-card__title">2\. Standards to meet<\/h3>/);
  assert.match(page, /\.quote-control-card__title \{ margin: 0 0 \.9rem/);
  assert.doesNotMatch(page, /\.quote-control-card legend \{ padding:/);
});

test("estimator adds company stage, employee scale, and sector context without inventing an industry surcharge", () => {
  assert.match(page, /\{ id: 'startup', label: 'Startup', amountUsd: 0/);
  assert.match(page, /\{ id: 'business', label: 'Business', amountUsd: 750/);
  assert.match(page, /\{ id: 'enterprise', label: 'Enterprise', amountUsd: 2000/);
  assert.match(page, /1–25 employees/);
  assert.match(page, /2,001\+ employees/);
  assert.match(page, /Software \/ SaaS/);
  assert.match(page, /Financial services \/ Fintech/);
  assert.match(page, /Healthcare \/ Life sciences/);
  assert.match(page, /sector helps us scope likely evidence and regulatory context but does not automatically increase the price/i);
  assert.match(runtime, /companyAmount \+ employeeAmount/);
  assert.doesNotMatch(runtime, /sectorAmount/);
});

test("quote completion is an explicit email handoff and carries the estimate snapshot", () => {
  assert.match(page, /Review & email my quote/);
  assert.match(page, /Email this quote to yourself/);
  assert.match(page, /copy <strong>hello@canonical\.plus<\/strong>/);
  assert.match(page, /data-intake-kind="quote"/);
  assert.match(page, /PUBLIC_CANONICAL_INTAKE_URL/);
  for (const field of ["estimate-range", "estimate-summary", "company-profile", "employee-band", "sector"]) {
    assert.match(page, new RegExp(`data-intake-${field}`));
  }
  assert.match(runtime, /const syncIntake =/);
  assert.match(runtime, /data-intake-estimate-range/);
  assert.match(runtime, /data-intake-sector/);
  assert.match(intake, /'Idempotency-Key': requestId/);
  assert.match(intake, /credentials: 'omit'/);
});

test("quote and contact handoff fails honestly when the backend endpoint is not configured", () => {
  assert.match(intake, /if \(!endpoint\)/);
  assert.match(intake, /Online delivery is being activated/);
  assert.match(intake, /Please email \$\{EMAIL\}/);
  assert.doesNotMatch(intake, /service_role|SUPABASE_SERVICE|NEON_DATABASE_URL|CANONICAL_INTERNAL_AUTH_TOKEN/i);
});

test("estimator exposes governed speed, framework, depth, and complexity factors", () => {
  assert.deepEqual(estimator.speeds.map((speed) => speed.weeks), [9, 5, 3]);
  for (const id of ["nist", "iso27001", "gdpr", "soc2"]) assert.ok(estimator.standards.some((standard) => standard.id === id));
  assert.equal(estimator.deliveryDepths.length, 3);
  assert.equal(estimator.complexities.length, 3);
  assert.match(page, /name="quote_standard"/);
  assert.match(page, /name="quote_delivery_depth"/);
  assert.match(page, /name="quote_complexity"/);
});

test("quote estimator authority remains internally consistent and bounded", () => {
  assert.equal(estimator.schemaVersion, 1);
  assert.match(estimator.currency, /^[A-Z]{3}$/);
  assert.equal(estimator.estimateFloorUsd, 5000);
  assert.equal(estimator.estimateCeilingUsd, 15000);
  assert.ok(estimator.midpointFloorUsd >= estimator.estimateFloorUsd);
  assert.ok(estimator.midpointCeilingUsd <= estimator.estimateCeilingUsd);
  assert.ok(estimator.lowerFactor > 0 && estimator.upperFactor >= estimator.lowerFactor);
  assert.ok(idsAreUnique(estimator.standards));
  assert.ok(idsAreUnique(estimator.deliveryDepths));
  assert.ok(idsAreUnique(estimator.complexities));
  assert.ok(amountsAreSafe(estimator.standards));
  assert.ok(amountsAreSafe(estimator.deliveryDepths));
  assert.ok(amountsAreSafe(estimator.complexities));
  assert.match(runtime, /clamp\(roundMoney\(midpoint \* lowerFactor\), floor, ceiling\)/);
  assert.match(runtime, /clamp\(roundMoney\(midpoint \* upperFactor\), lower, ceiling\)/);
});

test("all governed pricing combinations and added scale adjustments remain bounded", () => {
  const standardTotals = nonEmptyStandardTotals();
  const scaleAdjustments = [0, 500, 750, 1250, 2000, 2500, 4000, 6000];
  let combinationsChecked = 0;
  for (const speed of estimator.speeds) {
    for (const standardsUsd of standardTotals) {
      for (const depth of estimator.deliveryDepths) {
        for (const complexity of estimator.complexities) {
          for (const scaleUsd of scaleAdjustments) {
            const quote = calculateEstimate({ speedBaseUsd: speed.baseUsd, standardsUsd, depthUsd: depth.amountUsd, complexityUsd: complexity.amountUsd, scaleUsd });
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
  }
  assert.ok(combinationsChecked > 1000);
});

test("faster delivery and larger scale never reduce the bounded estimate", () => {
  const standardUsd = estimator.standards.filter((item) => ["soc2", "iso27001"].includes(item.id)).reduce((sum, item) => sum + item.amountUsd, 0);
  const depth = estimator.deliveryDepths[1];
  const complexity = estimator.complexities[1];
  const orderedSpeeds = [...estimator.speeds].sort((left, right) => right.weeks - left.weeks);
  let prior = calculateEstimate({ speedBaseUsd: orderedSpeeds[0].baseUsd, standardsUsd: standardUsd, depthUsd: depth.amountUsd, complexityUsd: complexity.amountUsd, scaleUsd: 0 });
  for (const speed of orderedSpeeds.slice(1)) {
    const next = calculateEstimate({ speedBaseUsd: speed.baseUsd, standardsUsd: standardUsd, depthUsd: depth.amountUsd, complexityUsd: complexity.amountUsd, scaleUsd: 0 });
    assert.ok(next.midpoint >= prior.midpoint && next.lower >= prior.lower && next.upper >= prior.upper);
    prior = next;
  }
  const small = calculateEstimate({ speedBaseUsd: 7500, standardsUsd: standardUsd, depthUsd: depth.amountUsd, complexityUsd: complexity.amountUsd, scaleUsd: 0 });
  const large = calculateEstimate({ speedBaseUsd: 7500, standardsUsd: standardUsd, depthUsd: depth.amountUsd, complexityUsd: complexity.amountUsd, scaleUsd: 6000 });
  assert.ok(large.midpoint >= small.midpoint && large.lower >= small.lower && large.upper >= small.upper);
});

test("commercial copy leads with readiness value while keeping precise engagement boundaries", () => {
  assert.match(page, /Readiness & pre-audit scoping/);
  assert.match(page, /Canonical Plus supports readiness assessments, pre-audit preparation, evidence organization, and technical remediation/);
  assert.match(page, /Milestone payment plans are available/);
  assert.match(page, /bundled-scope discounts/);
  assert.match(page, /Formal audit, certification, or authorization decisions remain with the qualified independent evaluator/);
  assert.doesNotMatch(page, />Sign in<\/a>|Sign in for account quote/);
});

test("runtime fails closed on invalid configuration and completed snapshots invalidate on edits", () => {
  assert.match(runtime, /const EXPECTED_SCHEMA_VERSION = 1/);
  assert.match(runtime, /const configurationValid =/);
  assert.match(runtime, /root\.dataset\.quoteRuntime = 'invalid'/);
  assert.match(runtime, /Estimate unavailable/);
  assert.match(runtime, /completeButton\.disabled = true/);
  assert.match(runtime, /const invalidateCompletedQuote =/);
  assert.match(runtime, /root\.addEventListener\('input', handleEstimatorChange\)/);
  assert.match(runtime, /root\.addEventListener\('change', handleEstimatorChange\)/);
});

test("public marketing code embeds no privileged database or email credentials", () => {
  const combined = `${page}\n${runtime}\n${intake}`;
  assert.doesNotMatch(combined, /service_role|SUPABASE_SERVICE|NEON_DATABASE_URL|CANONICAL_INTERNAL_AUTH_TOKEN|RESEND_API_KEY|SMTP_PASSWORD/i);
});
