import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const source = await read('../src/pages/people.astro');
const siteScript = await read('../public/site.js');
const nginx = await read('../nginx.conf');
const typeSpec = await read('../contracts/people/v1/main.tsp');
const authoredSchema = JSON.parse(await read('../contracts/people/v1/authored.schema.json'));
const directory = JSON.parse(await read('../contracts/people/v1/instances/PeopleDirectory/valid/canonical.json'));
const invalidMissingRole = JSON.parse(await read('../contracts/people/v1/instances/PeopleDirectory/invalid/missing-role.json'));
const workflow = await read('../.github/workflows/people-contract.yml');

const roster = [
  ['Alexander Mills', 'Integrations and DevOps'],
  ['John Siciliano', 'Security and Ops'],
  ['Jack Johnson', 'Browser, Mobile, Clientside'],
  ['Vikkie Pandey', 'Marketing and Sales'],
  ['Elijah Gizzarelli', 'Ops & HR'],
  ['Marcus Gerlach', 'Engineering'],
];

test('people directory has exactly six named roles in the requested order', () => {
  assert.equal(directory.schemaVersion, 'canonical-cloud.people/v1');
  assert.deepEqual(directory.people.map(({ name, role }) => [name, role]), roster);
  assert.equal(directory.people.length, 6);
  assert.equal(new Set(directory.people.map(({ id }) => id)).size, 6, 'person ids must be unique');
  assert.equal(new Set(directory.people.map(({ initials }) => initials)).size, 6, 'initials must be unique');
});

test('people page renders the validated directory instead of duplicating roster data', () => {
  assert.match(source, /contracts\/people\/v1\/instances\/PeopleDirectory\/valid\/canonical\.json/);
  assert.match(source, /const people = directory\.people/);
  assert.match(source, /people\.map\(\(person\)/);
  assert.match(source, /data-person-id=\{person\.id\}/);
  assert.match(source, /Six people, one readiness platform/);
  assert.doesNotMatch(source, /business\/legal counsel|Seven people/);
});

test('desktop layout is exactly two rows by three columns with responsive fallbacks', () => {
  assert.match(source, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.doesNotMatch(source, /last-child:nth-child\(3n \+ 1\)/);
  assert.match(source, /@media \(max-width: 900px\)[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(source, /@media \(max-width: 620px\)[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(source, /data-people-grid/);
  assert.match(source, /data-person-card/);
});

test('four verified Benefactor headshots are used and unresolved identities stay neutral', () => {
  const photos = directory.people.filter(({ photoUrl }) => photoUrl).map(({ photoUrl }) => photoUrl);
  assert.deepEqual(photos, [
    'https://benefactor.cc/team/alex-mills.jpg',
    'https://benefactor.cc/team/vinayak-pandey.png',
    'https://benefactor.cc/team/elijah-gizzarelli.jpeg',
    'https://benefactor.cc/team/marcus-gerlach.jpg',
  ]);

  for (const name of ['John Siciliano', 'Jack Johnson']) {
    assert.equal(directory.people.find((person) => person.name === name)?.photoUrl, undefined);
  }
  assert.match(source, /John and Jack use[\s\S]*neutral profile placeholders/);
  assert.doesNotMatch(JSON.stringify(directory), /linkedin\.com|avatars\.githubusercontent\.com/i);
});

test('people image dependency is restricted to Benefactor and covered by CSP', () => {
  for (const person of directory.people) {
    if (person.photoUrl) assert.match(person.photoUrl, /^https:\/\/benefactor\.cc\/team\//);
  }
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
