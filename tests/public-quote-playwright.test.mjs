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

test("playwright: scope answers qualify pricing without silent capped estimates", async (t) => {
  const server = await startSite();
  t.after(() => server.stop());
  const browser = await launchBrowser(t);
  const page = await browser.newPage({ viewport: { height: 900, width: 1280 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${server.url}/quote/`, { waitUntil: "networkidle" });

  const range = page.locator('[data-quote-range]');
  const button = page.locator('[data-complete-public-quote]');
  const runtime = page.locator('[data-quote-estimator]');
  assert.equal((await range.textContent())?.trim(), "$10,000–$12,500");
  assert.equal(await button.isEnabled(), true);

  await page.locator('select[name="quote_cloud_account_band"]').selectOption("3-10");
  assert.equal((await range.textContent())?.trim(), "$10,000–$12,500");
  assert.match(await page.locator('[data-quote-scope-details]').textContent() || "", /3–10/);

  await page.locator('select[name="quote_cloud_account_band"]').selectOption("11-plus");
  assert.equal((await range.textContent())?.trim(), "Custom scoping required");
  assert.equal(await runtime.getAttribute("data-quote-runtime"), "custom-scope");
  assert.equal(await button.isDisabled(), true);
  assert.match(await page.locator('[data-quote-custom-reason]').textContent() || "", /ten cloud/);

  await page.locator('select[name="quote_cloud_account_band"]').selectOption("1-2");
  assert.equal(await button.isEnabled(), true);
  assert.equal((await range.textContent())?.trim(), "$10,000–$12,500");

  await page.locator('input[name="quote_standard"][value="fedramp"]').check();
  assert.equal(await button.isDisabled(), true);
  assert.equal((await range.textContent())?.trim(), "Custom scoping required");
  await page.locator('input[name="quote_standard"][value="fedramp"]').uncheck();

  await page.locator('select[name="quote_evidence_maturity"]').selectOption("early");
  await page.locator('[data-quote-speed-slider]').fill("2");
  assert.equal(await button.isDisabled(), true);
  assert.match(await page.locator('[data-quote-custom-reason]').textContent() || "", /new program|three-week/);
  await page.locator('[data-quote-speed-slider]').fill("1");
  assert.equal(await button.isDisabled(), true);
  await page.locator('select[name="quote_evidence_maturity"]').selectOption("partial");
  assert.equal(await button.isEnabled(), true);
  assert.deepEqual(errors, []);
});

test("playwright: late email response cannot overwrite a changed scoped estimate", async (t) => {
  const server = await startSite();
  t.after(() => server.stop());
  const browser = await launchBrowser(t);
  const page = await browser.newPage({ viewport: { height: 900, width: 1280 } });
  const fixtureOrigin = "https://canonical-intake-fixture.supabase.co";
  let releaseResponse;
  const heldResponse = new Promise((resolve) => { releaseResponse = resolve; });
  let receivedSelection = null;

  await page.route(`${server.url}/quote/`, async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    const updated = html.replace('data-supabase-url=""', `data-supabase-url="${fixtureOrigin}"`);
    assert.notEqual(updated, html, "quote must expose a configurable, non-privileged intake URL");
    await route.fulfill({ response, body: updated });
  });

  await page.route(`${fixtureOrigin}/functions/v1/public-intake`, async (route) => {
    const headers = {
      "access-control-allow-origin": server.url,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "content-type": "application/json",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    receivedSelection = route.request().postDataJSON()?.selection;
    await heldResponse;
    await route.fulfill({
      status: 202,
      headers,
      body: JSON.stringify({
        accepted: true,
        quote: {
          range: { lowerUsd: 10000, upperUsd: 12500, currency: "USD" },
          summary: "Previously submitted, now stale",
        },
      }),
    });
  });

  await page.goto(`${server.url}/quote/`, { waitUntil: "networkidle" });
  assert.equal(await page.locator('[data-quote-estimator]').getAttribute("data-quote-runtime"), "ready");
  await page.locator('input[name="quote_email"]').fill("buyer@example.com");
  await page.locator('input[name="quote_company"]').fill("Example Co");

  const posted = page.waitForRequest(
    (request) => request.url().startsWith(fixtureOrigin) && request.method() === "POST",
  );
  await page.locator('[data-complete-public-quote]').click();
  await posted;
  assert.equal(receivedSelection?.scope?.productionSystems, "2-5");
  assert.equal(await page.locator('[data-complete-public-quote]').isDisabled(), true);

  await page.locator('select[name="quote_production_systems"]').selectOption("6-plus");
  assert.equal((await page.locator('[data-quote-range]').textContent())?.trim(), "Custom scoping required");
  releaseResponse();

  await page.locator('[data-quote-status]').getByText(/previous selection was submitted/i).waitFor();
  assert.equal(await page.locator('[data-quote-complete]').isHidden(), true);
  assert.equal((await page.locator('[data-quote-range]').textContent())?.trim(), "Custom scoping required");
  assert.equal(await page.locator('[data-complete-public-quote]').isDisabled(), true);
  assert.doesNotMatch(await page.locator('[data-quote-summary]').textContent() || "", /Previously submitted, now stale/);
});
