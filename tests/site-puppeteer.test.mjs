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
  assert.match(brand, /CANONICAL\.PLUS/);

  const navLinks = await page.$$eval(".nav__link", (nodes) =>
    nodes.map((node) => node.textContent?.trim()),
  );
  assert.deepEqual(navLinks, ["Readiness", "Process", "Frameworks", "Compare", "Sign in"]);
  assert.equal(
    await page.$eval("#nav-sign-in", (element) => element.href),
    "https://app.canonical.plus/u/readiness",
  );
  assert.equal(
    await page.$eval("#nav-quote", (element) => element.href),
    "https://app.canonical.plus/u/readiness",
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
    await page.$eval('a[href="mailto:compliance@canonical.cloud"]', (element) => Boolean(element)),
    true,
  );
  assert.match(await pageText(page), /Readiness, not independent assurance/);
  assert.match(await pageText(page), /canonical\.plus\. All rights reserved/);

  assert.deepEqual(pageErrors, []);
});
