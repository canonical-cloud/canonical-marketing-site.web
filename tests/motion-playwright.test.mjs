import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { chromeExecutablePath, startSite } from './site-browser-harness.mjs';

test('GSAP motion progressively enhances the landing page without runtime errors', async (t) => {
  const server = await startSite();
  t.after(() => server.stop());
  const browser = await chromium.launch({
    executablePath: chromeExecutablePath(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1360, height: 850 }, reducedMotion: 'no-preference' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(server.url + '/', { waitUntil: 'networkidle' });
  await page.locator('html.site-motion-enabled').waitFor();
  assert.equal(await page.locator('.readiness-signal span').count(), 4);
  await page.locator('#services').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('.services__card').count(), 4);
  assert.deepEqual(errors, []);
});

test('reduced motion leaves cards visible and disables motion enhancements', async (t) => {
  const server = await startSite();
  t.after(() => server.stop());
  const browser = await chromium.launch({
    executablePath: chromeExecutablePath(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  t.after(() => browser.close());
  const page = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
  await page.goto(server.url + '/', { waitUntil: 'networkidle' });
  assert.equal(await page.locator('html.site-motion-enabled').count(), 0);
  assert.equal(await page.locator('[data-motion-reveal]').count(), 0);
  assert.equal(await page.locator('.services__card').count(), 4);
  assert.equal(await page.locator('.site-scroll-progress').evaluate((el) => getComputedStyle(el).display), 'none');
});
