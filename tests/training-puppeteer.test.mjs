import assert from "node:assert/strict";
import { test } from "node:test";
import puppeteer from "puppeteer";
import { chromeExecutablePath, startSite } from "./site-browser-harness.mjs";

const completeRequiredCheckpoints = async (page) => {
  await page.$$eval('#training-checkpoints input[data-required="true"]', (inputs) => {
    for (const input of inputs) {
      if (!input.checked) input.click();
    }
  });
};

const nodeId = (page) => page.evaluate(() => new URL(window.location.href).searchParams.get('node'));

test("puppeteer: training graph advances only after required checkpoints", async (t) => {
  const server = await startSite();
  t.after(() => server.stop());

  const browser = await puppeteer.launch({
    executablePath: chromeExecutablePath(),
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  t.after(() => browser.close());

  const page = await browser.newPage();
  await page.setViewport({ height: 900, width: 1280 });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${server.url}/training/?node=engineering-change`, { waitUntil: "networkidle0" });
  await page.waitForSelector('button[data-next-node="control-design"]');
  assert.equal(await nodeId(page), 'engineering-change');
  assert.equal(
    await page.$eval('button[data-next-node="control-design"]', (button) => button.disabled),
    true,
  );

  await completeRequiredCheckpoints(page);
  assert.equal(
    await page.$eval('button[data-next-node="control-design"]', (button) => button.disabled),
    false,
  );
  await page.$eval('button[data-next-node="control-design"]', (button) => button.click());
  await page.waitForFunction(() => new URL(window.location.href).searchParams.get('node') === 'control-design');
  assert.equal(await nodeId(page), 'control-design');

  await completeRequiredCheckpoints(page);
  await page.$eval('button[data-next-node="evidence-ops"]', (button) => button.click());
  await page.waitForFunction(() => new URL(window.location.href).searchParams.get('node') === 'evidence-ops');
  assert.equal(await nodeId(page), 'evidence-ops');
  assert.equal(new URL(page.url()).hash, '');
  assert.deepEqual(pageErrors, []);
});

test("puppeteer: an outcome can cycle back to the training entry node", async (t) => {
  const server = await startSite();
  t.after(() => server.stop());

  const browser = await puppeteer.launch({
    executablePath: chromeExecutablePath(),
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  t.after(() => browser.close());

  const page = await browser.newPage();
  await page.goto(`${server.url}/training/?node=outcome-assurance`, { waitUntil: "networkidle0" });
  assert.equal(
    await page.$eval('#training-outcome', (element) => element.dataset.tierId),
    'assurance-engineering',
  );
  await completeRequiredCheckpoints(page);
  await page.$eval('button[data-next-node="start"]', (button) => button.click());
  await page.waitForFunction(() => new URL(window.location.href).searchParams.get('node') === 'start');
  assert.equal(await nodeId(page), 'start');
});
