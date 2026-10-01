import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { chromeExecutablePath, startSite } from "./site-browser-harness.mjs";

async function launchBrowser(t) {
  const browser = await chromium.launch({
    executablePath: chromeExecutablePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  t.after(() => browser.close());
  return browser;
}

test("playwright: quote cannot complete when JavaScript is unavailable", async (t) => {
  const server = await startSite();
  t.after(() => server.stop());
  const browser = await launchBrowser(t);
  const context = await browser.newContext({ javaScriptEnabled: false });
  t.after(() => context.close());
  const page = await context.newPage();

  await page.goto(`${server.url}/quote/`, { waitUntil: "domcontentloaded" });

  const estimator = page.locator('[data-quote-estimator]');
  const completion = page.locator('[data-quote-complete]');
  const completeButton = page.locator('[data-complete-public-quote]');

  assert.equal(await estimator.getAttribute('data-quote-runtime'), null);
  assert.equal(await completion.isHidden(), true);
  assert.equal((await page.locator('[data-quote-range]').textContent())?.trim(), '$11,000–$13,500');

  await completeButton.click();
  assert.equal(await completion.isHidden(), true, 'static fallback must never create a completed quote');
});

test("playwright: malformed runtime config disables the entire estimator before completion", async (t) => {
  const server = await startSite();
  t.after(() => server.stop());
  const browser = await launchBrowser(t);
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();

  await page.route('**/quote-estimator.js', async (route) => {
    const response = await route.fetch();
    const original = await response.text();
    await route.fulfill({
      response,
      body: `document.querySelector('[data-quote-estimator]').dataset.floor = 'NaN';\n${original}`,
    });
  });

  await page.goto(`${server.url}/quote/`, { waitUntil: "networkidle" });

  const estimator = page.locator('[data-quote-estimator]');
  const completeButton = page.locator('[data-complete-public-quote]');
  const completion = page.locator('[data-quote-complete]');

  assert.equal(await estimator.getAttribute('data-quote-runtime'), 'invalid');
  assert.equal(await estimator.getAttribute('aria-disabled'), 'true');
  assert.equal((await page.locator('[data-quote-range]').textContent())?.trim(), 'Estimate unavailable');
  assert.equal(await completeButton.isDisabled(), true);
  assert.equal(await page.locator('[data-quote-speed-slider]').isDisabled(), true);
  assert.equal(await page.locator('input[name="quote_standard"]').first().isDisabled(), true);
  assert.equal(await page.locator('input[name="quote_delivery_depth"]').first().isDisabled(), true);
  assert.equal(await page.locator('input[name="quote_complexity"]').first().isDisabled(), true);
  assert.equal(await page.locator('input[name="quote_company_profile"]').first().isDisabled(), true);
  assert.equal(await page.locator('select[name="quote_employee_band"]').isDisabled(), true);
  assert.equal(await page.locator('select[name="quote_sector"]').isDisabled(), true);
  assert.equal(await completion.isHidden(), true);
});
