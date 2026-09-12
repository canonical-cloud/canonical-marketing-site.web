import assert from 'node:assert/strict';
import { test } from 'node:test';
import puppeteer from 'puppeteer';
import { chromeExecutablePath, startSite } from './site-browser-harness.mjs';

const expectedPeople = [
  ['Alexander Mills', 'Integrations and DevOps'],
  ['John Siciliano', 'Security and Ops'],
  ['Jack Johnson', 'Browser, Mobile, Clientside'],
  ['Vikkie Pandey', 'Marketing and Sales'],
  ['Elijah Gizzarelli', 'Ops & HR'],
  ['Marcus Gerlach', 'Engineering'],
];

test('puppeteer: people page renders six cards in a responsive 3-by-2 desktop grid', async (t) => {
  const server = await startSite();
  t.after(() => server.stop());

  const browser = await puppeteer.launch({
    executablePath: chromeExecutablePath(),
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  t.after(() => browser.close());

  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.url().startsWith('https://benefactor.cc/team/')) {
      request.abort();
      return;
    }
    request.continue();
  });

  await page.setViewport({ height: 900, width: 1440 });
  await page.goto(`${server.url}/people/`, { waitUntil: 'networkidle0' });

  assert.equal(await page.title(), 'People | canonical.plus');

  const people = await page.$$eval('[data-person-card]', (cards) =>
    cards.map((card) => [
      card.querySelector('h3')?.textContent?.trim(),
      card.querySelector('.person-card__body p')?.textContent?.trim(),
    ]),
  );
  assert.deepEqual(people, expectedPeople);

  const columnCount = async () => page.$eval('[data-people-grid]', (grid) =>
    getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
  );

  assert.equal(await columnCount(), 3);

  await page.setViewport({ height: 900, width: 800 });
  assert.equal(await columnCount(), 2);

  await page.setViewport({ height: 900, width: 500 });
  assert.equal(await columnCount(), 1);

  const remotePhotos = await page.$$('[data-people-photo]');
  assert.equal(remotePhotos.length, 4);
  await page.$$eval('[data-people-photo]', (images) => {
    for (const image of images) image.dispatchEvent(new Event('error'));
  });
  assert.equal(
    await page.$$eval('[data-people-photo]', (images) => images.every((image) => image.hidden)),
    true,
  );

  const placeholders = await page.$$eval('.person-card__fallback span', (nodes) =>
    nodes.map((node) => node.textContent?.trim()),
  );
  assert.deepEqual(placeholders, ['AM', 'JS', 'JJ', 'VP', 'EG', 'MG']);
});
