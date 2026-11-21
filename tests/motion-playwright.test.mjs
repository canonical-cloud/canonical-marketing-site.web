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


test('OS reduced-motion changes clean up and re-enable motion live', async (t) => {
  const server = await startSite();
  t.after(() => server.stop());
  const browser = await chromium.launch({
    executablePath: chromeExecutablePath(), headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1360, height: 850 }, reducedMotion: 'no-preference' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(server.url + '/', { waitUntil: 'networkidle' });
  await page.locator('html.site-motion-enabled').waitFor();
  assert.ok(await page.locator('[data-motion-reveal]').count() > 10);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => !document.documentElement.classList.contains('site-motion-enabled') &&
    document.querySelectorAll('[data-motion-reveal]').length === 0);
  assert.equal(await page.locator('.site-scroll-progress').evaluate((el) => getComputedStyle(el).display), 'none');
  for (const selector of ['.page-hero__panel', '.services__card', '.readiness-signal span']) {
    const actual = await page.locator(selector).first().evaluate((el) => ({
      opacity: getComputedStyle(el).opacity,
      transform: el.style.transform,
    }));
    assert.equal(actual.opacity, '1', selector + ' must remain visible with reduced motion');
    assert.equal(actual.transform, '', selector + ' must not retain an animated transform');
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('html.site-motion-enabled').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('[data-motion-reveal]').length > 10);
  assert.deepEqual(errors, []);
});

test('focused scroll-reveal link becomes completely visible to keyboard users', async (t) => {
  const server = await startSite();
  t.after(() => server.stop());
  const browser = await chromium.launch({
    executablePath: chromeExecutablePath(), headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1360, height: 850 }, reducedMotion: 'no-preference' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(server.url + '/', { waitUntil: 'networkidle' });
  await page.locator('html.site-motion-enabled').waitFor();
  const link = page.locator('.audience-link-grid a').first();
  assert.ok(await link.count() > 0);
  await link.focus();
  await page.waitForFunction(() => {
    const el = document.querySelector('.audience-link-grid a');
    return el && Number.parseFloat(getComputedStyle(el).opacity) >= 0.99;
  });
  assert.equal(await link.evaluate((el) => document.activeElement === el), true);
  assert.deepEqual(errors, []);
});

test('JavaScript-disabled mobile visitors retain all visible content', async (t) => {
  const server = await startSite();
  t.after(() => server.stop());
  const browser = await chromium.launch({
    executablePath: chromeExecutablePath(), headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  t.after(() => browser.close());
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    javaScriptEnabled: false, reducedMotion: 'reduce',
  });
  await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('html.site-motion-enabled').count(), 0);
  assert.equal(await page.locator('.services__card').count(), 4);
  assert.equal(await page.locator('[data-motion-reveal]').count(), 0);
  assert.equal(await page.locator('.page-hero__panel').isVisible(), true);
  assert.equal(await page.locator('.readiness-signal').getAttribute('aria-hidden'), 'true');
});
