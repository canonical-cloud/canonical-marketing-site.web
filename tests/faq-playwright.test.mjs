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


test("playwright: FAQ search filters answers, shows empty state, and resets safely", async (t) => {
  const server = await startSite();
  t.after(() => server.stop());
  const browser = await chromium.launch({
    executablePath: chromeExecutablePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${server.url}/faq/`, { waitUntil: "networkidle" });

  const search = page.getByRole("searchbox", { name: /Search all 58 questions/ });
  await search.waitFor({ state: "visible" });
  assert.equal(await page.locator(".faq-item:visible").count(), 58);

  // Match answer text, not just question headings.
  await search.fill("privileged roles");
  const visible = await page.locator(".faq-item:visible").count();
  assert.ok(visible >= 1 && visible < 58);
  assert.equal(await page.locator("#faq-identity-controls").isVisible(), true);
  assert.match(await page.locator("#faq-search-status").innerText(), /matching .* out of 58/);

  await search.fill("not-a-real-compliance-topic-xyz");
  assert.equal(await page.locator(".faq-item:visible").count(), 0);
  assert.equal(await page.locator("#faq-search-empty").isVisible(), true);

  // Untrusted input must stay plain text.
  await search.fill('<img src=x onerror=alert(1)>');
  assert.equal(await page.locator("#faq-search-empty").isVisible(), true);
  assert.equal(await page.locator("img[src='x']").count(), 0);
  await page.getByRole("button", { name: "Clear search" }).click();
  assert.equal(await page.locator(".faq-item:visible").count(), 58);
  assert.equal(await page.locator("#faq-search-empty").isVisible(), false);

  const sizes = await page.evaluate(() => ({
    viewport: window.innerWidth,
    width: document.documentElement.scrollWidth,
  }));
  assert.ok(sizes.width <= sizes.viewport + 1, `FAQ search overflows mobile: ${JSON.stringify(sizes)}`);
  assert.deepEqual(pageErrors, []);
});

test("playwright: question deep links open automatically, including after filtering", async (t) => {
  const server = await startSite();
  t.after(() => server.stop());
  const browser = await chromium.launch({
    executablePath: chromeExecutablePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  t.after(() => browser.close());
  const page = await browser.newPage();

  await page.goto(`${server.url}/faq/#faq-critical-finding`, { waitUntil: "networkidle" });
  assert.equal(await page.locator("#faq-critical-finding").evaluate((e) => e.open), true);

  // Return to the unfragmented URL so the next navigation fires hashchange.
  await page.goto(`${server.url}/faq/`, { waitUntil: "networkidle" });
  const search = page.getByRole("searchbox", { name: /Search all 58 questions/ });
  await search.fill("privileged roles");
  assert.equal(await page.locator("#faq-critical-finding").isVisible(), false);
  await page.evaluate(() => { location.hash = "#faq-critical-finding"; });
  await page.waitForFunction(() => {
    const element = document.getElementById("faq-critical-finding");
    return element instanceof HTMLDetailsElement && element.open && !element.hidden;
  });
  assert.equal(await search.inputValue(), "");
  assert.equal(await page.locator(".faq-item:visible").count(), 58);

  await search.fill("privileged roles");
  await page.getByRole("link", { name: /Working with Canonical Plus/ }).click();
  assert.equal(await search.inputValue(), "");
  assert.equal(new URL(page.url()).hash, "#working-together");
});

test("playwright: FAQ stays readable with JavaScript disabled", async (t) => {
  const server = await startSite();
  t.after(() => server.stop());
  const browser = await chromium.launch({
    executablePath: chromeExecutablePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  t.after(() => browser.close());

  const page = await browser.newPage({ javaScriptEnabled: false });
  await page.goto(`${server.url}/faq/`);
  assert.equal(await page.locator(".faq-item").count(), 58);
  assert.equal(await page.locator("#faq-search-tools").isVisible(), false);
  const details = page.locator("#faq-why-preaudit");
  await details.locator("summary").focus();
  await page.keyboard.press("Enter");
  assert.equal(await details.evaluate((e) => e.open), true);
  assert.match(await details.locator(".faq-item__answer").innerText(), /independent audit examines evidence/);
});
