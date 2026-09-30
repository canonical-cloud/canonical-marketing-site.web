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

test("public quote runtime admits completion only after validation", () => {
  const booting = runtime.indexOf("root.dataset.quoteRuntime = 'booting'");
  const initialDisable = runtime.indexOf("completeButton.disabled = true");
  const validity = runtime.indexOf("const configurationValid =");
  const ready = runtime.indexOf("root.dataset.quoteRuntime = 'ready'");
  const enable = runtime.indexOf("completeButton.disabled = false");

  assert.ok(booting >= 0);
  assert.ok(initialDisable > booting);
  assert.ok(validity > initialDisable);
  assert.ok(ready > validity);
  assert.ok(enable > ready);
});

test("invalid public quote runtime disables all estimator controls", () => {
  assert.match(runtime, /root\.setAttribute\('aria-disabled', 'true'\)/);
  assert.match(runtime, /for \(const control of allControls\) control\.disabled = true/);
  assert.match(runtime, /completedPanel instanceof HTMLElement\) completedPanel\.hidden = true/);
});

test("runtime requires complete DOM and default-selection shape before ready", () => {
  assert.match(runtime, /const requiredNodesPresent =/);
  assert.match(runtime, /option\.index === index/);
  assert.match(runtime, /speedSlider\.type === 'range'/);
  assert.match(runtime, /Number\(speedSlider\.max\) === speedOptions\.length - 1/);
  assert.match(runtime, /standardInputs\.some\(\(input\) => input instanceof HTMLInputElement && input\.checked\)/);
  assert.match(runtime, /exactlyOneChecked\(depthInputs\)/);
  assert.match(runtime, /exactlyOneChecked\(complexityInputs\)/);
});
