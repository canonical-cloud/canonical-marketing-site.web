import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const ORIGIN = 'https://canonical.plus';
const ROUTES = ['/', '/people/'];
const FIELDS = ['id', 'name', 'role', 'description'];

/** Compare the actual server-rendered roster with the approved checked-out directory. */
export function assertLivePeople(expected, actual) {
  assert.equal(expected.length, 15, 'expected exactly 15 approved team profiles');
  assert.equal(new Set(expected.map((person) => person.id)).size, 15, 'duplicate approved profile ID');
  for (const person of expected) {
    for (const field of FIELDS) {
      assert.equal(typeof person[field], 'string', `approved profile missing ${field}`);
      assert.ok(person[field].trim(), `approved profile has an empty ${field}`);
    }
  }
  assert.deepEqual(actual, expected.map((person) =>
    Object.fromEntries(FIELDS.map((field) => [field, person[field]]))
  ), 'deployed profile titles, descriptions, order, or IDs disagree with approved source');
}

export async function verifyLivePeople() {
  const source = JSON.parse(await readFile(
    new URL('../contracts/people/v1/instances/PeopleDirectory/valid/canonical.json', import.meta.url),
    'utf8',
  ));
  const expected = source.people;
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ javaScriptEnabled: false });
    for (const route of ROUTES) {
      const requestedUrl = new URL(route, ORIGIN);
      const response = await page.goto(requestedUrl.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      assert.ok(response, `no HTTP response for ${route}`);
      assert.equal(response.status(), 200, `unexpected HTTP status for ${route}`);
      const servedUrl = new URL(page.url());
      assert.equal(servedUrl.origin, ORIGIN, 'production check was redirected to another origin');
      assert.equal(servedUrl.pathname, route, 'production route was redirected');
      const actual = await page.$$eval('[data-person-card]', (cards) => cards.map((card) => ({
        id: card.getAttribute('data-person-id'),
        name: card.querySelector('h3')?.textContent?.trim(),
        role: card.querySelector('.person-card__role')?.textContent?.trim(),
        description: card.querySelector('[data-person-description]')?.textContent?.trim(),
      })));
      assertLivePeople(expected, actual);
    }
    return { status: 'PASS', origin: ORIGIN, pagesChecked: ROUTES.length, profilesChecked: expected.length };
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  verifyLivePeople().then((result) => {
    console.log(JSON.stringify(result));
  }).catch((error) => {
    console.error(`LIVE_PEOPLE_SMOKE_FAILED: ${error.message}`);
    process.exitCode = 1;
  });
}
