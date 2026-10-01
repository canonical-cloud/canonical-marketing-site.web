import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const estimator = JSON.parse(await readFile(new URL("src/data/quote-estimator.json", root), "utf8"));
const tiers = JSON.parse(await readFile(new URL("src/data/service-tiers.json", root), "utf8"));
const runtime = await readFile(new URL("public/quote-estimator.js", root), "utf8");

const currency = (value) => typeof value === "string" && /^[A-Z]{3}$/.test(value);

test("static fallback and interactive estimator use one currency", () => {
  assert.ok(currency(estimator.currency));
  assert.ok(currency(tiers.source.currency));
  assert.equal(estimator.currency, tiers.source.currency);
});

test("public quote runtime validates configuration before becoming ready", () => {
  const booting = runtime.indexOf("root.dataset.quoteRuntime = 'booting'");
  const validity = runtime.indexOf("const configurationValid =");
  const invalid = runtime.indexOf("root.dataset.quoteRuntime = 'invalid'");
  const ready = runtime.indexOf("root.dataset.quoteRuntime = 'ready'");
  assert.ok(booting >= 0);
  assert.ok(validity >= 0);
  assert.ok(invalid >= 0);
  assert.ok(ready > validity);
});

test("runtime requires company profile and quote delivery controls", () => {
  assert.match(runtime, /stageSelect/);
  assert.match(runtime, /employeeInput/);
  assert.match(runtime, /sectorSelect/);
  assert.match(runtime, /emailInput/);
  assert.match(runtime, /selectedEmployeeBand/);
  assert.match(runtime, /company_profile:/);
  assert.match(runtime, /kind: 'quote'/);
});

test("runtime clamps employee count and monetary output", () => {
  assert.match(runtime, /clamp\(Math\.round\(Number\(employeeInput\.value\) \|\| 1\), 1, 1000000\)/);
  assert.match(runtime, /clamp\(rawMidpoint, midpointFloor, midpointCeiling\)/);
  assert.match(runtime, /clamp\(roundMoney\(midpoint \* lowerFactor\), floor, ceiling\)/);
  assert.match(runtime, /clamp\(roundMoney\(midpoint \* upperFactor\), lower, ceiling\)/);
});

test("runtime submits only through the configured public intake endpoint", () => {
  assert.match(runtime, /fetch\(intakeEndpoint/);
  assert.match(runtime, /credentials: 'omit'/);
  assert.match(runtime, /referrerPolicy: 'strict-origin-when-cross-origin'/);
  assert.doesNotMatch(runtime, /service_role|SUPABASE_SERVICE|RESEND_API_KEY|NEON_DATABASE_URL/i);
});
