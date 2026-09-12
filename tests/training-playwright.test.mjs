import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { chromeExecutablePath, startSite } from "./site-browser-harness.mjs";

const completeRequiredCheckpoints = async (page) => {
  const checkpoints = page.locator('#training-checkpoints input[data-required="true"]');
  for (let index = 0; index < (await checkpoints.count()); index += 1) {
    await checkpoints.nth(index).check();
  }
};

test("playwright: training choices unlock, navigate, and cycle without hash routing", async (t) => {
  const server = await startSite();
  t.after(() => server.stop());

  const browser = await chromium.launch({
    executablePath: chromeExecutablePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { height: 900, width: 1280 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${server.url}/training/`, { waitUntil: "networkidle" });
  await page.waitForSelector('button[data-next-node="buyer-request"]');
  assert.equal(await page.locator('button[data-next-node="buyer-request"]').isDisabled(), true);

  await completeRequiredCheckpoints(page);
  assert.equal(await page.locator('button[data-next-node="buyer-request"]').isDisabled(), false);
  await page.locator('button[data-next-node="buyer-request"]').click();
  await page.waitForFunction(() => new URL(window.location.href).searchParams.get('node') === 'buyer-request');
  assert.match(await page.locator('#training-title').textContent(), /Translate the buyer request/);
  assert.equal(new URL(page.url()).hash, "");

  await completeRequiredCheckpoints(page);
  await page.locator('button[data-next-node="framework-map"]').click();
  await page.waitForFunction(() => new URL(window.location.href).searchParams.get('node') === 'framework-map');
  assert.match(await page.locator('#training-title').textContent(), /Frameworks overlap/);

  await page.goBack({ waitUntil: "networkidle" });
  await page.waitForFunction(() => new URL(window.location.href).searchParams.get('node') === 'buyer-request');
  assert.match(await page.locator('#training-title').textContent(), /Translate the buyer request/);

  await page.goto(`${server.url}/training/?node=outcome-managed`, { waitUntil: "networkidle" });
  await page.waitForSelector('#training-outcome:not([hidden])');
  assert.equal(await page.locator('#training-outcome').getAttribute('data-tier-id'), 'managed-readiness');
  await completeRequiredCheckpoints(page);
  await page.locator('button[data-next-node="start"]').click();
  await page.waitForFunction(() => new URL(window.location.href).searchParams.get('node') === 'start');
  assert.match(await page.locator('#training-title').textContent(), /What brought you here/);

  assert.deepEqual(pageErrors, []);
});

test("playwright: prices page renders all three reviewed starting assumptions", async (t) => {
  const server = await startSite();
  t.after(() => server.stop());

  const browser = await chromium.launch({
    executablePath: chromeExecutablePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  t.after(() => browser.close());

  const page = await browser.newPage();
  await page.goto(`${server.url}/prices/`, { waitUntil: "networkidle" });
  const text = await page.locator('body').innerText();
  for (const value of ['$2,500', '$7,500', '$20,000']) assert.match(text, new RegExp(value.replace('$', '\\$')));
  for (const tier of ['Foundation Readiness', 'Managed Readiness', 'Assurance Engineering']) assert.match(text, new RegExp(tier));
  assert.match(text, /Proposed starting prices/i);
  assert.match(text, /signed statement of work/i);
});
