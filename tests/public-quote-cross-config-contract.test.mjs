import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const estimator = JSON.parse(await readFile(new URL("src/data/quote-estimator.json", root), "utf8"));
const tiers = JSON.parse(await readFile(new URL("src/data/service-tiers.json", root), "utf8"));
const runtime = await readFile(new URL("public/quote-estimator.js", root), "utf8");

test("static and recurring pricing use one currency", () => {
  assert.match(estimator.currency, /^[A-Z]{3}$/);
  assert.equal(estimator.currency, tiers.source.currency);
});

test("runtime boots fail-closed then marks validated configuration ready", () => {
  const booting = runtime.indexOf("root.dataset.quoteRuntime = 'booting'");
  const validity = runtime.indexOf("const configurationValid =");
  const invalid = runtime.indexOf("root.dataset.quoteRuntime = 'invalid'");
  const ready = runtime.indexOf("root.dataset.quoteRuntime = 'ready'");
  assert.ok(booting >= 0);
  assert.ok(validity > booting);
  assert.ok(invalid > validity);
  assert.ok(ready > validity);
});

test("runtime validates all v2 pricing dimensions", () => {
  assert.match(runtime, /selectOptionsValid\(companyStage, 'multiplier'\)/);
  assert.match(runtime, /selectOptionsValid\(employeeBand, 'amount'\)/);
  assert.match(runtime, /selectOptionsValid\(sector, 'amount'\)/);
  assert.match(runtime, /standardInputs\.every\(pricedInputValid\)/);
  assert.match(runtime, /exactlyOneChecked\(depthInputs\)/);
  assert.match(runtime, /exactlyOneChecked\(complexityInputs\)/);
});

test("invalid configuration disables the estimator", () => {
  assert.match(runtime, /root\.setAttribute\('aria-disabled', 'true'\)/);
  assert.match(runtime, /Estimate unavailable/);
  assert.match(runtime, /control\.disabled = true/);
});
