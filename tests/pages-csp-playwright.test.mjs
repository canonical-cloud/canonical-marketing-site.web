import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { chromeExecutablePath, startSite } from "./site-browser-harness.mjs";

test("Pages-style static serving enforces meta CSP but preserves FAQ and quote scripts", async (t) => {
  const server = await startSite();
  t.after(() => server.stop());
  const browser = await chromium.launch({
    executablePath: chromeExecutablePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  t.after(() => browser.close());
  const page = await browser.newPage();

  const response = await page.goto(`${server.url}/faq/`, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200);
  const headers = await response.allHeaders();
  assert.equal(headers["content-security-policy"], undefined,
    "test must exercise a static host without a response CSP");
  assert.equal(await page.locator(".faq-item").count(), 58);
  assert.equal(await page.locator("#faq-search-tools").isVisible(), true);

  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  assert.match(policy, /script-src 'self'/);
  await page.evaluate(() => {
    const script = document.createElement("script");
    script.textContent = "window.__injectedFaqScriptRan = true";
    document.head.append(script);
  });
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__injectedFaqScriptRan), undefined,
    "meta CSP must block injected executable inline code on a headerless static host");

  const search = page.getByRole("searchbox", { name: /Search all 58 questions/ });
  await search.fill("privileged roles");
  assert.equal(await page.locator("#faq-identity-controls").isVisible(), true);
  assert.ok((await page.locator(".faq-item:visible").count()) < 58);

  const quoteResponse = await page.goto(`${server.url}/quote/`, { waitUntil: "networkidle" });
  assert.equal(quoteResponse.status(), 200);
  assert.equal(await page.locator('[data-quote-estimator]').getAttribute("data-quote-runtime"), "ready");
});
