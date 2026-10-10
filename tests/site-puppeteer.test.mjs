import assert from "node:assert/strict";
import { test } from "node:test";
import puppeteer from "puppeteer";
import { chromeExecutablePath, startSite } from "./site-browser-harness.mjs";

const pageText = (page) => page.evaluate(() => document.body.innerText);

test("puppeteer renders the readiness-first canonical.plus landing page", async (t) => {
  const server = await startSite();
  t.after(() => server.stop());

  const browser = await puppeteer.launch({
    executablePath: chromeExecutablePath(),
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  t.after(() => browser.close());

  const page = await browser.newPage();
  await page.setViewport({ height: 900, width: 1440 });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${server.url}/`, { waitUntil: "networkidle0" });
  assert.equal(await page.title(), "Compliance readiness for software teams | canonical.plus");

  const heroTitle = await page.$eval(".hero__title", (element) =>
    (element.textContent ?? "").replace(/\s+/g, " ").trim(),
  );
  assert.match(heroTitle, /Know what stands between you and\s*audit-ready/);

  const brand = await page.$eval(".nav__logo-text", (element) =>
    (element.textContent ?? "").replace(/\s+/g, "").trim(),
  );
  assert.ok(brand.includes("CANONICAL.PLUS"));

  // The live DOM and computed CSS must never insert a Product badge,
  // including via the ::before pseudo-element or a redundant ARIA label.
  const logo = await page.$eval("#nav-logo", (element) => {
    const plusName = element.querySelector(".nav__plus-brand-name");
    return {
      text: element.innerText,
      aria: element.getAttribute("aria-label"),
      innerAria: plusName?.getAttribute("aria-label") ?? null,
      className: plusName?.className ?? "",
      beforeContent: plusName ? getComputedStyle(plusName, "::before").content : null,
      legacyBadgeCount: element.querySelectorAll("[class*='product-brand']").length,
    };
  });
  assert.match(logo.text, /CANONICAL CLOUD/);
  assert.ok(logo.text.replace(/\s+/g, "").includes("CANONICAL.PLUS"));
  assert.equal(logo.text.toLowerCase().includes("product"), false);
  assert.equal(logo.aria, "Canonical Cloud — canonical.plus home");
  assert.equal(logo.innerAria, null);
  assert.equal(logo.legacyBadgeCount, 0);
  assert.equal(logo.className.includes("nav__plus-brand-name"), true);
  assert.ok(["none", "normal", '""'].includes(logo.beforeContent), `unexpected generated header label: ${logo.beforeContent}`);

  const navLinks = await page.$$eval(".nav__link", (nodes) =>
    nodes.map((node) => node.textContent?.trim()),
  );
  assert.deepEqual(navLinks, ["Readiness", "Process", "Frameworks", "Compare", "People"]);
  assert.equal(
    await page.$eval("#nav-people", (element) => new URL(element.href).pathname),
    "/people/",
  );
  assert.equal(await page.$("#nav-sign-in"), null);

  // The primary quote CTA is intentionally public and same-origin. Authentication
  // is not presented until a supported sign-in experience exists.
  const publicQuoteUrl = new URL('/quote/', server.url).href;
  assert.equal(
    await page.$eval("#nav-quote", (element) => element.href),
    publicQuoteUrl,
  );

  const serviceCards = await page.$$eval("#services .services__card h3", (nodes) =>
    nodes.map((node) => node.textContent?.trim()),
  );
  assert.deepEqual(serviceCards, [
    "Readiness assessment",
    "Technical remediation roadmap",
    "Evidence operations",
    "Independent-review handoff",
  ]);

  assert.equal(
    await page.$eval('a[href="mailto:hello@canonical.plus"]', (element) => Boolean(element)),
    true,
  );
  assert.match(await pageText(page), /Canonical supports readiness and pre-audits/);
  assert.match(await pageText(page), /canonical\.plus\. All rights reserved/);

  assert.deepEqual(pageErrors, []);
});
