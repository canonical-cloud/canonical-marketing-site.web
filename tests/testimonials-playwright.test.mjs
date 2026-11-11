import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { chromeExecutablePath, startSite } from './site-browser-harness.mjs';

// An isolated synthetic fixture tests the exact source CSS. These are NOT real
// customers or quotes; nothing is added to a public page or deployable asset.
const component = await readFile(
  new URL('../src/components/TestimonialsGrid.astro', import.meta.url), 'utf8');
const css = component.match(/<style>([\s\S]*?)<\/style>/)?.[1];
assert.ok(css?.includes('.testimonial-grid'));

test('testimonials: unpublished homepage has no implied customer endorsement', async (t) => {
  const server = await startSite();
  t.after(() => server.stop());
  const browser = await chromium.launch({
    executablePath: chromeExecutablePath(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  t.after(() => browser.close());
  const page = await browser.newPage({viewport: {width: 1440, height: 900}});
  await page.goto(server.url + '/', {waitUntil: 'networkidle'});
  assert.equal(await page.locator('#testimonials').count(), 0);
  assert.equal(await page.locator('[data-testimonial-id]').count(), 0);
  assert.equal(await page.locator('.testimonial-card__logo').count(), 0);

  await page.addStyleTag({content: css});
  await page.evaluate(() => {
    const section = document.createElement('section');
    section.id = 'testimonial-layout-only-fixture';
    section.className = 'section testimonials';
    const container = document.createElement('div');
    container.className = 'container';
    const grid = document.createElement('div');
    grid.className = 'testimonial-grid';
    for (let i = 0; i < 8; i += 1) {
      const figure = document.createElement('figure');
      figure.className = 'testimonial-card';
      const img = document.createElement('img');
      img.className = 'testimonial-card__logo';
      img.alt = '';
      img.src = '/brand/canonical-cloud.svg';
      img.width = 190;
      img.height = 64;
      const quote = document.createElement('blockquote');
      quote.className = 'testimonial-card__quote';
      quote.textContent = 'Synthetic fixture text only ' + i;
      const caption = document.createElement('figcaption');
      caption.className = 'testimonial-card__attribution';
      const company = document.createElement('span');
      company.className = 'testimonial-card__company';
      company.textContent = 'Fixture ' + i;
      const speaker = document.createElement('span');
      speaker.className = 'testimonial-card__person';
      speaker.textContent = 'Test-only attribution';
      caption.append(company, speaker);
      figure.append(img, quote, caption);
      grid.append(figure);
    }
    container.append(grid);
    section.append(container);
    document.querySelector('main').append(section);
  });
  await page.locator('#testimonial-layout-only-fixture img').first().evaluate((img) => img.decode());

  for (const [width, expectedColumns, expectedRows] of [
    [1440, 4, 2],
    [850, 2, 4],
    [390, 1, 8],
  ]) {
    await page.setViewportSize({width, height: 900});
    for (const theme of ['light', 'medium', 'dark']) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      const geometry = await page.evaluate(() => {
        const grid = document.querySelector('#testimonial-layout-only-fixture .testimonial-grid');
        const cards = Array.from(grid.querySelectorAll('figure'));
        const bounds = grid.getBoundingClientRect();
        const cols = getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length;
        const rows = new Set(cards.map((card) => Math.round(card.getBoundingClientRect().top))).size;
        return {
          columns: cols,
          rows,
          count: cards.length,
          cardsFit: cards.every((card) => {
            const r = card.getBoundingClientRect();
            return r.left >= bounds.left - 1 && r.right <= bounds.right + 1;
          }),
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          decorativeLogos: cards.every((card) => card.querySelector('img')?.getAttribute('alt') === ''),
          allLogosLoaded: cards.every((card) => {
            const img = card.querySelector('img');
            return img.complete && img.naturalWidth > 0;
          }),
        };
      });
      assert.deepEqual(
        [geometry.columns, geometry.rows, geometry.count],
        [expectedColumns, expectedRows, 8],
        'grid failed at ' + width + 'px / ' + theme + ': ' + JSON.stringify(geometry),
      );
      assert.ok(geometry.cardsFit && !geometry.overflow &&
        geometry.decorativeLogos && geometry.allLogosLoaded, JSON.stringify(geometry));
    }
  }
});
