import assert from "node:assert/strict";
import { test } from "node:test";
import puppeteer from "puppeteer";
import { chromeExecutablePath, startSite } from "./site-browser-harness.mjs";

async function open(t) {
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
  return { page, pageErrors };
}

test("puppeteer: outcome strip shows the four readiness deliverables in order", async (t) => {
  const { page, pageErrors } = await open(t);

  const outcomes = await page.$$eval(".outcome-strip__item", (items) =>
    items.map((item) => ({
      name: item.querySelector("strong")?.textContent?.trim(),
      description: item.querySelector("span")?.textContent?.trim(),
    })),
  );
  assert.deepEqual(outcomes, [
    { name: "Gap map", description: "What is missing or not yet evidenced" },
    { name: "Control roadmap", description: "What to implement, in what order, and why" },
    { name: "Evidence plan", description: "What an independent reviewer is likely to request" },
    { name: "Handoff boundary", description: "What Canonical prepares versus what an assessor decides" },
  ]);
  assert.deepEqual(pageErrors, []);
});

test("puppeteer: process section lists the four ordered readiness phases", async (t) => {
  const { page, pageErrors } = await open(t);

  const steps = await page.$$eval("#process .process-step h3", (nodes) =>
    nodes.map((node) => node.textContent?.trim()),
  );
  assert.deepEqual(steps, [
    "Scope the real system",
    "Assess controls and evidence",
    "Remediate by risk and dependency",
    "Prepare the independent handoff",
  ]);
  assert.deepEqual(pageErrors, []);
});

test("puppeteer: hero CTAs target the readiness app and explanatory page", async (t) => {
  const { page, pageErrors } = await open(t);

  assert.equal(
    await page.$eval("#hero-cta-primary", (element) => element.getAttribute("href")),
    "https://app.canonical.plus/u/readiness",
  );
  assert.equal(
    await page.$eval("#hero-cta-primary", (element) => element.getAttribute("data-application-link")),
    "quote",
  );
  assert.equal(
    await page.$eval("#hero-cta-secondary", (element) => element.getAttribute("href")),
    "/readiness/",
  );

  const featured = await page.$$eval("#frameworks .frameworks__item h4", (nodes) =>
    nodes.map((node) => node.textContent?.trim()),
  );
  assert.deepEqual(featured, [
    "SOC 2",
    "ISO 27001",
    "HIPAA",
    "NIST CSF 2.0",
    "GDPR",
    "PCI DSS 4.0",
    "CMMC 2.0",
    "CSA CCM",
  ]);
  assert.deepEqual(pageErrors, []);
});

test("puppeteer: Process navigation reaches the same-page readiness section", async (t) => {
  const { page, pageErrors } = await open(t);

  const processLinkIndex = await page.$$eval(".nav__link", (nodes) =>
    nodes.findIndex((node) => node.textContent?.trim() === "Process"),
  );
  assert.ok(processLinkIndex >= 0, "expected a Process nav link");

  const links = await page.$$(".nav__link");
  await links[processLinkIndex].click();
  await page.waitForFunction(() => location.hash === "#process");

  assert.equal(new URL(page.url()).hash, "#process");
  assert.equal(
    await page.$eval("#process", (element) => element.tagName.toLowerCase()),
    "section",
  );
  assert.deepEqual(pageErrors, []);
});
