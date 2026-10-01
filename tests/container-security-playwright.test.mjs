import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { test } from "node:test";
import { chromium } from "playwright";
import { chromeExecutablePath } from "./site-browser-harness.mjs";
import { writeBrowserFailureDiagnostics } from "./browser-failure-diagnostics.mjs";

const serverUrl = process.env.CANONICAL_SITE_TEST_URL;
const requireSecurityHeaders = process.env.CANONICAL_REQUIRE_SECURITY_HEADERS === "1";

test("playwright verifies the shipped web surface enforces browser security policy", { skip: !serverUrl }, async (t) => {
  const browser = await chromium.launch({
    executablePath: chromeExecutablePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  t.after(() => browser.close());

  const artifactDirectory = process.env.CANONICAL_BROWSER_ARTIFACT_DIR;
  if (artifactDirectory) await mkdir(artifactDirectory, { recursive: true });

  const page = await browser.newPage({ viewport: { height: 900, width: 1440 } });
  const pageErrors = [];
  const externalRequests = [];
  const sourceOrigin = new URL(serverUrl).origin;

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    const target = new URL(request.url());
    if (target.origin !== sourceOrigin) externalRequests.push(request.url());
  });

  try {
    let response = await page.goto(`${serverUrl}/`, { waitUntil: "networkidle" });
    assert.ok(response);
    assert.equal(response.status(), 200);

    if (requireSecurityHeaders) {
      const headers = response.headers();
      const csp = headers["content-security-policy"] || "";
      assert.match(csp, /default-src 'self'/);
      assert.match(csp, /script-src 'self'/);
      const scriptDirective = csp.split(';').map((part) => part.trim()).find((part) => part.startsWith('script-src')) || '';
      assert.doesNotMatch(scriptDirective, /'unsafe-inline'/);
      assert.equal(headers["x-content-type-options"], "nosniff");
      assert.equal(headers["x-frame-options"], "DENY");
      assert.ok(headers["referrer-policy"]);
      assert.ok(headers["permissions-policy"]);
      assert.equal(headers["cross-origin-opener-policy"], "same-origin");
    }

    assert.equal(
      await page.evaluate(() => typeof window.canonicalTheme?.apply),
      "function",
      "external theme bootstrap must execute under the production CSP",
    );
    assert.equal(
      await page.locator("#nav-people").getAttribute("href"),
      "/people/",
      "external site bootstrap must execute and add the People navigation link",
    );
    assert.equal(await page.locator("#nav-sign-in").count(), 0);
    assert.equal(await page.locator("#nav-quote").getAttribute("href"), "/quote/");

    const inlineResult = await page.evaluate(() => {
      window.__canonicalInlineScriptExecuted = undefined;
      const script = document.createElement("script");
      script.textContent = "window.__canonicalInlineScriptExecuted = true";
      document.body.append(script);
    });
    assert.equal(inlineResult, undefined);
    await page.waitForTimeout(100);
    assert.equal(
      await page.evaluate(() => window.__canonicalInlineScriptExecuted),
      undefined,
      "the response CSP must block executable inline script",
    );

    // Exercise the no-login estimator through the exact deployable nginx/CSP
    // surface. This catches route-specific script/CSP regressions that the
    // landing-page security probe cannot see.
    response = await page.goto(`${serverUrl}/quote/`, { waitUntil: "networkidle" });
    assert.ok(response);
    assert.equal(response.status(), 200);
    assert.equal(await page.locator('[data-quote-estimator]').getAttribute('data-quote-runtime'), 'ready');
    assert.equal((await page.locator('[data-quote-range]').textContent())?.trim(), '$11,000–$13,500');
    await page.locator('[data-complete-public-quote]').click();
    assert.equal(await page.locator('[data-quote-complete]').isVisible(), true);

    // Neither the landing page nor the public quote flow may silently expand
    // the production network/CSP trust surface before explicit form submission.
    assert.deepEqual(externalRequests, []);
    assert.deepEqual(pageErrors, []);
  } catch (error) {
    try {
      const result = await writeBrowserFailureDiagnostics({
        artifactDirectory,
        page,
        error,
        sourceUrl: serverUrl,
      });
      if (result) console.error(`browser diagnostics written to ${result}`);
    } catch (diagnosticsError) {
      console.error("failed to write browser diagnostics", diagnosticsError);
    }
    throw error;
  }
});
