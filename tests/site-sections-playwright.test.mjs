import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { chromeExecutablePath, startSite } from "./site-browser-harness.mjs";

async function open(t, path = "/", viewport = { height: 900, width: 1440 }) {
  const server = await startSite();
  t.after(() => server.stop());

  const browser = await chromium.launch({
    executablePath: chromeExecutablePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${server.url}${path}`, { waitUntil: "networkidle" });
  return { page, pageErrors };
}

test("playwright: landing page lists the eight featured readiness frameworks", async (t) => {
  const { page, pageErrors } = await open(t);

  const frameworks = await page.locator("#frameworks .frameworks__item").evaluateAll((items) =>
    items.map((item) => ({
      name: item.querySelector("h4")?.textContent?.trim(),
      scope: item.querySelector("p")?.textContent?.trim(),
    })),
  );
  assert.deepEqual(frameworks, [
    { name: "SOC 2", scope: "Trust Services Criteria readiness" },
    { name: "ISO 27001", scope: "Information security management" },
    { name: "HIPAA", scope: "Healthcare security and privacy" },
    { name: "NIST CSF 2.0", scope: "Cybersecurity program maturity" },
    { name: "GDPR", scope: "Privacy and data-protection operations" },
    { name: "PCI DSS 4.0", scope: "Payment-card security controls" },
    { name: "CMMC 2.0", scope: "Defense supply-chain readiness" },
    { name: "CSA CCM", scope: "Cloud control assurance mapping" },
  ]);
  assert.deepEqual(pageErrors, []);
});

test("playwright: the differentiators state readiness and independence boundaries", async (t) => {
  const { page, pageErrors } = await open(t);

  const items = await page.locator("#about .why__item h4").allInnerTexts();
  assert.deepEqual(
    items.map((text) => text.trim()),
    [
      "Readiness before assurance",
      "Engineering-aware remediation",
      "Reusable control mapping",
      "Transparent platform fit",
    ],
  );
  assert.deepEqual(pageErrors, []);
});

test("playwright: contact CTA preserves the application and email boundaries", async (t) => {
  const { page, pageErrors } = await open(t);

  const contact = page.locator("#contact");
  await contact.waitFor({ state: "visible" });
  await contact.getByRole("link", { name: /Start readiness assessment/ }).waitFor({ state: "visible" });
  assert.equal(
    await page.locator("#cta-readiness-btn").getAttribute("href"),
    "https://app.canonical.plus/u/quote",
  );
  assert.equal(
    await page.locator("#cta-contact-btn").getAttribute("href"),
    "mailto:compliance@canonical.cloud",
  );
  assert.deepEqual(pageErrors, []);
});

test("playwright: page ships readiness SEO metadata, a single h1, and survives mobile", async (t) => {
  const { page, pageErrors } = await open(t, "/", { height: 812, width: 375 });

  const meta = async (selector) => page.locator(selector).getAttribute("content");
  assert.match(await meta('meta[name="description"]'), /identify compliance gaps/);
  assert.match(await meta('meta[property="og:title"]'), /Compliance readiness/);
  assert.ok((await meta('meta[property="og:description"]'))?.length > 0);

  assert.equal(await page.locator("h1").count(), 1);
  await page.locator(".nav__logo-text").first().waitFor({ state: "attached" });
  await page.locator("#hero-cta-primary").first().waitFor({ state: "visible" });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
  assert.ok(overflow, "page should not scroll horizontally on a 375px viewport");
  assert.deepEqual(pageErrors, []);
});

test("playwright: readiness, frameworks, and comparison pages render independently", async (t) => {
  const { page, pageErrors } = await open(t, "/readiness/");

  await page.getByRole("heading", { level: 1 }).filter({ hasText: /Get ready for independent review/ }).waitFor();
  await page.goto(page.url().replace("/readiness/", "/frameworks/"), { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1 }).filter({ hasText: /Readiness across/ }).waitFor();
  await page.goto(page.url().replace("/frameworks/", "/compare/"), { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1 }).filter({ hasText: /Readiness support is not a substitute/ }).waitFor();
  await page.getByText(/Vanta/).first().waitFor();
  await page.getByText(/not positioned as a mature hundreds-of-integrations/).waitFor();

  assert.deepEqual(pageErrors, []);
});
