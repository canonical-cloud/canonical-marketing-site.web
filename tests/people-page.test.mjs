import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const source = await read('../src/pages/people.astro');
const grid = await read('../src/components/PeopleGrid.astro');
const home = await read('../src/pages/index.astro');
const siteScript = await read('../public/site.js');
const nginx = await read('../nginx.conf');
const typeSpec = await read('../contracts/people/v1/main.tsp');
const authoredSchema = JSON.parse(await read('../contracts/people/v1/authored.schema.json'));
const directory = JSON.parse(await read('../contracts/people/v1/instances/PeopleDirectory/valid/canonical.json'));
const invalidMissingRole = JSON.parse(await read('../contracts/people/v1/instances/PeopleDirectory/invalid/missing-role.json'));
const workflow = await read('../.github/workflows/people-contract.yml');

const roster = [
  ['Alexander Mills', 'Integrations and DevOps'],
  ['John Siliciano', 'DevOps, Security & Infrastructure Expert'],
  ['Jack Johnson', 'Browser, Mobile, Clientside'],
  ['Vikkie Pandey', 'Marketing and Sales'],
  ['Elijah Gizzarelli', 'Ops & HR'],
  ['Marcus Gerlach', 'Engineering'],
  ['Eugene Li', 'CPA & Legal'],
  ['Tom Mensch', 'Software & Legal'],
];

test('people directory has exactly eight named roles in the requested order', () => {
  assert.equal(directory.schemaVersion, 'canonical-cloud.people/v1');
  assert.deepEqual(directory.people.map(({ name, role }) => [name, role]), roster);
  assert.equal(directory.people.length, 8);
  assert.equal(new Set(directory.people.map(({ id }) => id)).size, 8, 'person ids must be unique');
  assert.equal(new Set(directory.people.map(({ initials }) => initials)).size, 8, 'initials must be unique');
});

test('homepage and people page share the validated directory', () => {
  assert.match(grid, /contracts\/people\/v1\/instances\/PeopleDirectory\/valid\/canonical\.json/);
  assert.match(grid, /const people = directory\.people/);
  assert.match(grid, /people\.map\(\(person\)/);
  assert.match(grid, /data-person-id=\{person\.id\}/);
  assert.match(source, /Eight people, one readiness platform/);
  for (const page of [source, home]) assert.match(page, /<PeopleGrid\s*\/>/);
});

test('desktop layout has two rows of four with tablet and mobile layouts', () => {
  assert.match(grid, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(grid, /@media \(max-width: 1000px\)[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(grid, /@media \(max-width: 620px\)[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(grid, /data-people-grid/);
  assert.match(grid, /data-person-card/);
});

test('four verified Benefactor headshots are used and unresolved identities stay neutral', () => {
  const photos = directory.people.filter(({ photoUrl }) => photoUrl).map(({ photoUrl }) => photoUrl);
  assert.deepEqual(photos, [
    '/team/alex-mills.jpg',
    '/team/vinayak-pandey.png',
    '/team/elijah-gizzarelli.jpeg',
    '/team/marcus-gerlach.jpg',
  ]);

  for (const name of ['John Siliciano', 'Jack Johnson', 'Eugene Li', 'Tom Mensch']) {
    assert.equal(directory.people.find((person) => person.name === name)?.photoUrl, undefined);
  }
  assert.match(grid, /person-card__fallback/);
  assert.doesNotMatch(JSON.stringify(directory), /linkedin\.com|avatars\.githubusercontent\.com/i);
});

test('Benefactor portraits are served locally and remain base-aware', async () => {
  for (const person of directory.people) {
    if (person.photoUrl) {
      assert.match(person.photoUrl, /^\/team\/[a-z-]+\.(?:jpe?g|png)$/);
      const image = await readFile(new URL(`../public${person.photoUrl}`, import.meta.url));
      assert.ok(image.length > 0);
    }
  }
  assert.match(grid, /import\.meta\.env\.BASE_URL/);
  assert.match(grid, /src=\{`\$\{baseNoSlash\}\$\{person\.photoUrl\}`\}/);
  assert.match(nginx, /img-src 'self' data: https:\/\/benefactor\.cc;/);
});

test('people navigation is base-aware and inserted before account actions', () => {
  assert.match(siteScript, /id = 'nav-people'/);
  assert.match(siteScript, /textContent = 'People'/);
  assert.match(siteScript, /new URL\('\.\.\/people\/', readinessLink\.href\)/);
  assert.match(siteScript, /signInLink\.before\(peopleLink\)/);
});

test('failed remote portraits fall back without inline handlers', () => {
  assert.match(grid, /data-people-photo/);
  assert.doesNotMatch(grid, /\sonerror\s*=/i);
  assert.match(siteScript, /querySelectorAll\('\[data-people-photo\]'\)/);
  assert.match(siteScript, /image\.hidden = true/);
});

test('TypeSpec and JSON Schema expose matching People declarations', () => {
  for (const declaration of ['PersonProfile', 'PeopleDirectory']) {
    assert.match(typeSpec, new RegExp(`model ${declaration}\\b`));
    assert.ok(authoredSchema.$defs[declaration], `missing authored JSON Schema declaration ${declaration}`);
  }
  assert.equal(authoredSchema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.ok(authoredSchema.$defs.PersonProfile.required.includes('role'));
  assert.equal(invalidMissingRole.people[0].role, undefined);
});

test('people contract workflow pins reviewed TJSV and fails closed on the corpus', () => {
  assert.match(workflow, /93dd73cb246a09b0a1c62d7192cc62ca6ecbe405/);
  assert.match(workflow, /typespec-json-schema-validator\.mjs check/);
  assert.match(workflow, /--typespec=contracts\/people\/v1\/main\.tsp/);
  assert.match(workflow, /--schema=contracts\/people\/v1\/authored\.schema\.json/);
  assert.match(workflow, /--instances=contracts\/people\/v1\/instances/);
  assert.match(workflow, /people\.parity\.json/);
});
