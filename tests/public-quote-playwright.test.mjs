import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { chromeExecutablePath, startSite } from "./site-browser-harness.mjs";

const launchBrowser = async (t) => {
  const browser = await chromium.launch({
    executablePath: chromeExecutablePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  t.after(() => browser.close());
  return browser;
};

test("playwright: public quote completes locally without auth, persistence, or network submission", async (t) => {
  const server = await startSite();
  t.after(() => server.stop());
  const browser = await launchBrowser(t);
  const context = await browser.newContext({ viewport: { height: 900, width: 1280 } });
  t.after(() => context.close());
  const page = await context.newPage();

  const pageErrors = [];
  const interactionRequests = [];
  let interactionsStarted = false;
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (interactionsStarted) interactionRequests.push(request.url());
  });

  await page.goto(`${server.url}/quote/`, { waitUntil: "networkidle" });
  interactionsStarted = true;

  const estimator = page.locator('[data-quote-estimator]');
  const range = page.locator('[data-quote-range]');
  const slider = page.locator('[data-quote-speed-slider]');
  const completion = page.locator('[data-quote-complete]');

  assert.equal(await estimator.getAttribute('data-quote-runtime'), 'ready');
  assert.equal((await range.textContent())?.trim(), '$9,500–$12,000');
  assert.equal(await slider.getAttribute('aria-valuetext'), '5 weeks');
  assert.equal(await page.locator('a[data-quote-login]').first().getAttribute('href'), 'https://app.canonical.plus/u/quote');

  await slider.fill('2');
  assert.equal((await range.textContent())?.trim(), '$12,000–$15,000');
  assert.equal(await slider.getAttribute('aria-valuetext'), '3 weeks');

  const standards = page.locator('input[name="quote_standard"]');
  for (let index = 0; index < (await standards.count()); index += 1) {
    await standards.nth(index).uncheck();
  }
  await page.locator('[data-complete-public-quote]').click();
  assert.equal(await page.locator('[data-standard-error]').isVisible(), true);
  assert.equal(await page.locator('[data-standards-group]').getAttribute('aria-invalid'), 'true');
  assert.equal(await standards.first().evaluate((element) => element === document.activeElement), true);
  assert.equal(await completion.isHidden(), true);

  await standards.first().check();
  await page.locator('[data-complete-public-quote]').click();
  assert.equal(await completion.isVisible(), true);
  assert.equal((await page.locator('[data-completed-range]').textContent())?.trim(), '$12,000–$15,000');
  assert.match((await page.locator('[data-completed-summary]').textContent()) ?? '', /3 weeks · SOC 2/);

  await page.locator('input[name="quote_delivery_depth"][value="remediation"]').check();
  assert.equal(await completion.isHidden(), true, 'changing an input must invalidate the completed snapshot');

  assert.deepEqual(interactionRequests, [], 'quote interactions must not submit or persist over the network');
  assert.deepEqual(pageErrors, []);
});

test("playwright: public quote remains usable at mobile width without horizontal overflow", async (t) => {
  const server = await startSite();
  t.after(() => server.stop());
  const browser = await launchBrowser(t);
  const page = await browser.newPage({ viewport: { height: 844, width: 390 } });

  await page.goto(`${server.url}/quote/`, { waitUntil: "networkidle" });
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.ok(dimensions.scrollWidth <= dimensions.clientWidth + 1, JSON.stringify(dimensions));
  assert.equal(await page.locator('[data-complete-public-quote]').isVisible(), true);
  assert.equal(await page.locator('[data-quote-login]').first().isVisible(), true);
});
