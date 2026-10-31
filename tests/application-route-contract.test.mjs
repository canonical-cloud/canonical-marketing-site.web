import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const indexPage = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
const siteScript = await readFile(new URL('../public/site.js', import.meta.url), 'utf8');
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

const supportedTarget = 'https://app.canonical.plus/u/quote';

test('marketing quote CTAs use public estimator; sanctioned customer app route remains separately pinned', () => {
  assert.match(indexPage, /const quoteHref = `\$\{baseNoSlash\}\/quote\/`/);
  assert.doesNotMatch(indexPage, /data-application-link="quote"/);
  assert.doesNotMatch(indexPage, /https:\/\/app\.canonical\.plus\/u\/quote/);
  assert.match(siteScript, /const QUOTE_PATH = '\/u\/quote'/);
  assert.match(siteScript, /new URL\(QUOTE_PATH, APP_ORIGIN\)/);
  assert.match(readme, /`https:\/\/app\.canonical\.plus\/u\/quote`/);

  for (const source of [indexPage, siteScript, readme]) {
    assert.doesNotMatch(source, /https:\/\/app\.canonical\.plus\/u\/readiness/);
    assert.doesNotMatch(source, /['"]\/u\/readiness['"]/);
  }
  assert.match(readme, /public no-login preliminary estimator/);

  assert.equal(new URL(supportedTarget).origin, 'https://app.canonical.plus');
});

test('application-link navigation never carries credential or return-target material', () => {
  const combined = `${indexPage}\n${siteScript}`;
  assert.doesNotMatch(combined, /access_token|refresh_token|id_token|return_to|authorization=/i);
  assert.doesNotMatch(combined, /[?&](?:token|tenant|subject|session)=/i);
});
