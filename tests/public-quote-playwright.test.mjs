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

test("playwright: quote v2 responds to scale factors and does not offer unavailable delivery", async (t) => {
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

  // Production Pages may intentionally build without PUBLIC_SUPABASE_URL.
  // A disabled email action must be consistent with the visible fallback.
  const submit = page.locator('[data-complete-public-quote]');
  assert.equal(await submit.isDisabled(), true);
  assert.equal(await page.locator('input[name="quote_email"]').getAttribute('required'), '');
  assert.equal(await page.locator('input[name="quote_company"]').getAttribute('required'), '');
  assert.match((await page.locator('[data-intake-unavailable]').textContent()) || '', /temporarily unavailable|hello@canonical\.plus/i);

  const standards = page.locator('input[name="quote_standard"]');
  for (let index = 0; index < (await standards.count()); index += 1) await standards.nth(index).uncheck();
  assert.equal(await submit.isDisabled(), true);
  await standards.first().check();
  assert.equal(await submit.isDisabled(), true);
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
  assert.equal(await page.locator('[data-complete-public-quote]').isDisabled(), true);
});

test("playwright: large, federal and unverified scopes do not show a routine quote", async (t) => {
  const server = await startSite();
  t.after(() => server.stop());
  const browser = await launchBrowser(t);
  const page = await browser.newPage({ viewport: { height: 900, width: 1280 } });
  await page.goto(`${server.url}/quote/`, { waitUntil: "networkidle" });
  const range = page.locator('[data-quote-range]');
  const runtime = page.locator('[data-quote-estimator]');
  const submit = page.locator('[data-complete-public-quote]');
  assert.equal(await runtime.getAttribute("data-quote-runtime"), "ready");

  await page.locator('select[name="quote_systems_in_scope"]').selectOption("six-plus");
  assert.equal((await range.textContent())?.trim(), "Custom scoping required");
  assert.equal(await runtime.getAttribute("data-quote-runtime"), "custom-scope");
  assert.equal(await submit.isDisabled(), true);

  await page.locator('select[name="quote_systems_in_scope"]').selectOption("two-to-five");
  assert.equal((await range.textContent())?.trim(), "$10,000–$12,500");
  assert.equal(await runtime.getAttribute("data-quote-runtime"), "ready");
  assert.equal(await submit.isDisabled(), true);


  for (const [name, custom, routine] of [
    ['quote_cloud_account_band', '11-plus', '1-2'],
    ['quote_control_owner_band', '21-plus', '1-5'],
    ['quote_data_footprint', 'multi-regulated', 'single'],
    ['quote_remediation_load', 'unknown', 'moderate'],
    ['quote_cloud_account_band', 'unknown', '1-2'],
    ['quote_control_owner_band', 'unknown', '1-5'],
    ['quote_data_footprint', 'unknown', 'single'],
  ]) {
    await page.locator(`select[name="${name}"]`).selectOption(custom);
    assert.equal((await range.textContent())?.trim(), 'Custom scoping required', name);
    assert.equal(await submit.isDisabled(), true, name);
    await page.locator(`select[name="${name}"]`).selectOption(routine);
    assert.equal((await range.textContent())?.trim(), '$10,000–$12,500', name);
    assert.equal(await runtime.getAttribute("data-quote-runtime"), "ready", name);
    assert.equal(await submit.isDisabled(), true, name);
  }
  await page.locator('select[name="quote_remediation_load"]').selectOption('heavy');
  assert.equal((await range.textContent())?.trim(), '$10,000–$12,500');
  await page.locator('input[name="quote_delivery_depth"][value="remediation"]').check();
  assert.equal((await range.textContent())?.trim(), 'Custom scoping required');
  await page.locator('select[name="quote_remediation_load"]').selectOption('moderate');
  await page.locator('input[name="quote_delivery_depth"][value="managed"]').check();
  assert.equal((await range.textContent())?.trim(), '$10,000–$12,500');

  await page.locator('input[name="quote_standard"][value="fedramp"]').check();
  assert.equal((await range.textContent())?.trim(), "Custom scoping required");
  assert.equal(await submit.isDisabled(), true);
  await page.locator('input[name="quote_standard"][value="fedramp"]').uncheck();

  await page.locator('select[name="quote_data_exposure"]').selectOption("unsure");
  assert.equal((await range.textContent())?.trim(), "Custom scoping required");
  await page.locator('select[name="quote_data_exposure"]').selectOption("business");

  await page.locator('[data-quote-speed-slider]').fill("2");
  await page.locator('select[name="quote_company_stage"]').selectOption("enterprise");
  await page.locator('select[name="quote_employee_band"]').selectOption("1001-plus");
  await page.locator('input[name="quote_delivery_depth"][value="remediation"]').check();
  await page.locator('input[name="quote_complexity"][value="complex"]').check();
  for (const id of ["nist", "gdpr", "hipaa", "pci", "cis"]) {
    await page.locator(`input[name="quote_standard"][value="${id}"]`).check();
  }
  assert.equal((await range.textContent())?.trim(), "Custom scoping required");
  assert.equal(await submit.isDisabled(), true);
  assert.equal(await page.locator('[data-quote-complete]').isHidden(), true);
});
