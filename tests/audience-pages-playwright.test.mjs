import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { chromeExecutablePath, startSite } from './site-browser-harness.mjs';

const slugs = ['startups', 'founders', 'sales-teams', 'technical-founders', 'vc-portfolios'];

test('playwright: five audience routes render with navigation, conversion paths, and boundaries', async (t) => {
  const server = await startSite();
  t.after(() => server.stop());
  const browser = await chromium.launch({
    executablePath: chromeExecutablePath(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  for (const slug of slugs) {
    await page.goto(`${server.url}/${slug}/`, { waitUntil: 'networkidle' });
    assert.match(await page.title(), /canonical\.plus$/);
    await page.locator('#audience-heading').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#outcomes .audience-benefit').count(), 3);
    assert.equal(await page.locator('#approach .process-step').count(), 3);
    assert.equal(await page.locator('#questions details').count(), 2);
    assert.equal(await page.locator('#other-teams .audience-route').count(), 4);
    assert.equal(
      await page.locator('a:has-text("Build a readiness quote")').first().getAttribute('href'),
      '/quote/',
    );
    assert.equal(
      await page.locator('a:has-text("Book an intro")').first().getAttribute('href'),
      'https://calendly.com/hello-canonical/30min',
    );
    assert.match(await page.locator('main').innerText(), /independent/i);
  }
  assert.deepEqual(errors, []);
});

test('playwright: mobile visitors can open startup navigation and read persona pages', async (t) => {
  const server = await startSite();
  t.after(() => server.stop());
  const browser = await chromium.launch({
    executablePath: chromeExecutablePath(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(`${server.url}/`, { waitUntil: 'networkidle' });
  await page.locator('#nav-toggle').click();
  await page.locator('#nav-startups').click();
  await page.waitForURL(/\/startups\/$/);
  await page.locator('#audience-heading').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#outcomes .audience-benefit').count(), 3);
  await page.locator('#questions details').first().locator('summary').click();
  assert.equal(await page.locator('#questions details').first().getAttribute('open'), '');
});
