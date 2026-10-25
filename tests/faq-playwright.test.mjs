import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { chromeExecutablePath, startSite } from "./site-browser-harness.mjs";

test("playwright: 58-question FAQ works with keyboard and mobile layout", async (t) => {
  const server = await startSite();
  t.after(() => server.stop());
  const browser = await chromium.launch({
    executablePath: chromeExecutablePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${server.url}/faq/`, { waitUntil: "networkidle" });
  assert.equal(await page.title(), "Frequently asked questions | canonical.plus");
  assert.equal(await page.locator(".faq-item").count(), 58);
  assert.equal(await page.locator(".faq-group").count(), 8);

  const newQuestion = page.locator("#faq-critical-finding");
  const answer = newQuestion.locator(".faq-item__answer");
  assert.equal(await newQuestion.evaluate((element) => element.open), false);
  await newQuestion.locator("summary").click();
  assert.equal(await newQuestion.evaluate((element) => element.open), true);
  assert.match(await answer.innerText(), /escalated through that agreed channel/);

  await page.getByRole("link", { name: /Cloud and engineering controls/ }).click();
  assert.equal(new URL(page.url()).hash, "#engineering-controls");

  await page.setViewportSize({ width: 375, height: 812 });
  const dimensions = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  assert.ok(dimensions.content <= dimensions.viewport + 1, `FAQ horizontal overflow: ${JSON.stringify(dimensions)}`);
  assert.deepEqual(pageErrors, []);

  await page.goto(`${server.url}/`, { waitUntil: "networkidle" });
  const fullFaqs = page.getByRole("link", { name: "Read all 58 FAQs" });
  assert.equal(await fullFaqs.getAttribute("href"), "/faq/");
});
