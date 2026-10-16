import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const file = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [layout, hub, article, diagrams, builtHub, builtArticle] = await Promise.all([
  file('../src/layouts/BaseLayout.astro'),
  file('../src/pages/insights/index.astro'),
  file('../src/pages/insights/cpp26-standardization.astro'),
  file('../docs/insights/cpp26-standardization.md'),
  file('../dist/insights/index.html'),
  file('../dist/insights/cpp26-standardization/index.html'),
]);

test('Insights hub and article are discoverable in the site', () => {
  assert.match(layout, /const insightsHref =/);
  assert.match(layout, /id="nav-insights">Insights<\/a>/);
  assert.match(layout, /<a href=\{insightsHref\} class="footer__link">Insights<\/a>/);
  assert.match(hub, /insights\/cpp26-standardization\//);
  assert.match(builtHub, /How C\+\+26 becomes an ISO standard/);
  assert.match(builtArticle, /id="pipeline"/);
  assert.match(builtArticle, /id="graph-title"/);
});

test('graphics remain static, meaningful and accessible without third-party JS', () => {
  assert.match(article, /<figure class="graph"/);
  assert.match(article, /<ol class="pipeline">/);
  assert.match(article, /aria-labelledby="graph-title"/);
  assert.match(article, /<figcaption>/);
  assert.match(article, /@media\(max-width:750px\)/);
  assert.doesNotMatch(article, /<script|https?:\/\/[^"']+\.js/i);
  assert.equal((diagrams.match(/~~~mermaid/g) || []).length, 3);
  for (const token of ['flowchart TD', 'flowchart LR', 'CWG', 'LWG', 'FDIS', 'ANSI', 'INCITS/C++']) {
    assert.ok(diagrams.includes(token), 'missing Mermaid detail: ' + token);
  }
});

test('correctly separates ISO publication, WG21 approval and national participation', () => {
  for (const name of ['ISO/IEC 14882', 'WG21', 'ANSI', 'INCITS/C++', 'DIS ballot stage 40.20', 'October 16, 2026']) {
    assert.ok(article.includes(name), 'missing important fact: ' + name);
  }
  assert.match(article, /not yet a published International Standard/);
  assert.match(article, /not a certification/);
  assert.match(article, /https:\/\/www\.iso\.org\/standard\/91179\.html/);
  assert.match(diagrams, /not a second C\+\+26 design process/);
});