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

test("playwright: quote v2 responds to scale factors and validates delivery fields", async (t) => {
  const server = await startSite();
  t.after(() => server.stop());
  const browser = await launchBrowser(t);
  const page = await browser.newPage({ viewport: { height: 900, width: 1280 } });

  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${server.url}/quote/`, { waitUntil: "networkidle" });

  const estimator = page.locator('[data-quote-estimator]');
  const range = page.locator('[data-quote-range]');
  assert.equal(await estimator.getAttribute("data-quote-runtime"), "ready");
  assert.equal((await range.textContent())?.trim(), "$10,000–$12,500");

  await page.locator('[data-quote-speed-slider]').fill("2");
  assert.equal((await range.textContent())?.trim(), "$13,000–$16,000");

  await page.locator('select[name="quote_company_stage"]').selectOption("enterprise");
  assert.equal((await range.textContent())?.trim(), "$14,500–$18,000");

  await page.locator('select[name="quote_employee_band"]').selectOption("1001-plus");
  const largerRange = (await range.textContent())?.trim() || "";
  assert.notEqual(largerRange, "$14,500–$18,000");

  const standards = page.locator('input[name="quote_standard"]');
  for (let index = 0; index < (await standards.count()); index += 1) await standards.nth(index).uncheck();
  await page.locator('input[name="quote_email"]').fill("buyer@example.com");
  await page.locator('input[name="quote_company"]').fill("Example Co");
  await page.locator('[data-complete-public-quote]').click();
  assert.equal(await page.locator('[data-standard-error]').isVisible(), true);

  await standards.first().check();
  await page.locator('[data-complete-public-quote]').click();
  assert.match((await page.locator('[data-quote-status]').textContent()) || "", /temporarily unavailable|hello@canonical\.plus/i);
  assert.equal(await page.locator('[data-quote-complete]').isHidden(), true);
  assert.deepEqual(pageErrors, []);
});

test("playwright: quote cards are responsive without horizontal overflow", async (t) => {
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
  assert.equal(await page.locator('.quote-control-card h3').first().isVisible(), true);
  assert.equal(await page.locator('[data-complete-public-quote]').isVisible(), true);
});

test("playwright: no-JavaScript fallback never creates a false sent quote", async (t) => {
  const server = await startSite();
  t.after(() => server.stop());
  const browser = await launchBrowser(t);
  const context = await browser.newContext({ javaScriptEnabled: false });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(`${server.url}/quote/`, { waitUntil: "load" });

  assert.equal((await page.locator('[data-quote-range]').textContent())?.trim(), "$10,000–$12,500");
  assert.equal(await page.locator('[data-quote-estimator]').getAttribute("data-quote-runtime"), null);
  assert.equal(await page.locator('[data-quote-complete]').isHidden(), true);
});
