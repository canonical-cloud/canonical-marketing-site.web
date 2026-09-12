import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const source = await readFile(new URL('../src/pages/people.astro', import.meta.url), 'utf8');
const siteScript = await readFile(new URL('../public/site.js', import.meta.url), 'utf8');
const nginx = await readFile(new URL('../nginx.conf', import.meta.url), 'utf8');

const roster = [
  ['Alexander Mills', 'Integrations and DevOps'],
  ['John Siciliano', 'Security and Ops'],
  ['Jack Johnson', 'Browser, Mobile, Clientside'],
  ['Vikkie Pandey', 'Marketing and Sales'],
  ['Elijah Gizzarelli', 'Ops & HR'],
  ['Marcus Gerlach', 'Engineering'],
];

test('people page has exactly six named roles in the requested order', () => {
  let previousIndex = -1;
  for (const [name, role] of roster) {
    const index = source.indexOf(`name: '${name}'`);
    assert.ok(index > previousIndex, `${name} is missing or out of order`);
    assert.ok(source.includes(`role: '${role}'`), `missing role for ${name}: ${role}`);
    previousIndex = index;
  }
  assert.equal((source.match(/name: '/g) ?? []).length, 6);
});

test('desktop layout is a two-row, three-column people grid with responsive fallbacks', () => {
  assert.match(source, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(source, /@media \(max-width: 900px\)[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(source, /@media \(max-width: 620px\)[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(source, /data-people-grid/);
  assert.match(source, /data-person-card/);
});

test('four verified Benefactor headshots are used and unresolved identities stay neutral', () => {
  for (const path of [
    'alex-mills.jpg',
    'vinayak-pandey.png',
    'elijah-gizzarelli.jpeg',
    'marcus-gerlach.jpg',
  ]) {
    assert.ok(source.includes(`\${photoSource}/${path}`), `missing Benefactor photo ${path}`);
  }

  assert.match(source, /name: 'John Siciliano',[\s\S]*?photo: null/);
  assert.match(source, /name: 'Jack Johnson',[\s\S]*?photo: null/);
  assert.match(source, /neutral profile placeholders until verified portraits are available/);
  assert.doesNotMatch(source, /linkedin\.com|avatars\.githubusercontent\.com/i);
});

test('people image dependency is restricted to Benefactor and covered by CSP', () => {
  assert.match(source, /const photoSource = 'https:\/\/benefactor\.cc\/team'/);
  assert.match(nginx, /img-src 'self' data: https:\/\/benefactor\.cc;/);
});

test('people navigation is base-aware and inserted before account actions', () => {
  assert.match(siteScript, /id = 'nav-people'/);
  assert.match(siteScript, /textContent = 'People'/);
  assert.match(siteScript, /new URL\('\.\.\/people\/', readinessLink\.href\)/);
  assert.match(siteScript, /signInLink\.before\(peopleLink\)/);
});

test('failed remote portraits fall back without inline handlers', () => {
  assert.match(source, /data-people-photo/);
  assert.doesNotMatch(source, /\sonerror\s*=/i);
  assert.match(siteScript, /querySelectorAll\('\[data-people-photo\]'\)/);
  assert.match(siteScript, /image\.hidden = true/);
});
