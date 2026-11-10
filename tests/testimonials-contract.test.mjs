import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const load = (path) => readFile(new URL(path, root), 'utf8');
const candidates = JSON.parse(await load('src/data/testimonial-candidates.json'));
const component = await load('src/components/TestimonialsGrid.astro');
const homeSource = await load('src/pages/index.astro');

const approved = (entry) =>
  entry.approvedForPublication === true &&
  ['relationshipEvidence', 'publicationConsent', 'quote', 'attribution']
    .every((field) => typeof entry[field] === 'string' && entry[field].trim().length > 0);

test('eight testimonial candidates preserve requested 2×4 order', () => {
  assert.deepEqual(candidates.map((entry) => entry.company), [
    'ChannelMeter', 'Vultr', 'Trinity Labs', 'Interos.ai',
    'Luma Health', 'Benefactor.cc', 'Polka', 'Bose Audio',
  ]);
  assert.equal(new Set(candidates.map((entry) => entry.id)).size, 8);
  assert.match(component, /repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(component, /max-width: 1024px/);
  assert.match(component, /max-width: 640px/);
  assert.match(homeSource, /<TestimonialsGrid \/>/);
});

test('publication is fail-closed: all eight need evidence, consent, and authentic quotes', async () => {
  assert.match(component, /entry\.approvedForPublication === true/);
  assert.match(component, /approved\.length === 8/);
  assert.match(component, /candidates\.length === 8/);
  const home = await load('dist/index.html');
  if (candidates.length !== 8 || !candidates.every(approved)) {
    assert.doesNotMatch(home, /id="testimonials"/, 'unapproved wall must not ship');
    for (const { company } of candidates) {
      assert.ok(!home.includes(`data-testimonial-id=`), `unapproved testimonial leaked: ${company}`);
    }
  } else {
    assert.match(home, /id="testimonials"/);
    assert.equal((home.match(/data-testimonial-id=/g) || []).length, 8);
    for (const { company } of candidates) assert.ok(home.includes(company));
  }
});
