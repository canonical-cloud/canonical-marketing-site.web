import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const file = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [layout, hub, article, legacy, blogsIndex, diagrams, builtHub, builtArticle, builtLegacy, builtBlogsIndex] = await Promise.all([
  file('../src/layouts/BaseLayout.astro'),
  file('../src/pages/insights/index.astro'),
  file('../src/pages/blogs/1.astro'),
  file('../src/pages/insights/cpp26-standardization.astro'),
  file('../src/pages/blogs/index.astro'),
  file('../docs/insights/cpp26-standardization.md'),
  file('../dist/insights/index.html'),
  file('../dist/blogs/1/index.html'),
  file('../dist/insights/cpp26-standardization/index.html'),
  file('../dist/blogs/index.html'),
]);

test('long-form C++26 blog is the single canonical article, linked from Insights', () => {
  assert.match(layout, /const insightsHref =/);
  assert.match(layout, /id="nav-insights">Insights<\/a>/);
  assert.match(hub, /\/blogs\/1\//);
  assert.match(builtHub, /How C\+\+26 becomes an ISO standard/);
  assert.match(builtHub, /\/blogs\/1\//);
  assert.match(builtArticle, /id="people"/);
  assert.match(builtArticle, /id="pipeline"/);
  assert.match(builtArticle, /id="iso-approval"/);
  assert.match(builtArticle, /id="us-approval"/);
  assert.match(builtArticle, /id="status-cpp"/);
  assert.match(builtArticle, /id="engineering"/);
  assert.match(builtArticle, /id="sources"/);
});

test('legacy article URL and /blogs/ index resolve to the current content hub', () => {
  assert.match(legacy, /Astro\.redirect/);
  assert.match(legacy, /\/blogs\/1\//);
  assert.match(blogsIndex, /Astro\.redirect/);
  assert.match(blogsIndex, /\/insights\//);
  assert.match(builtLegacy, /blogs\/1/);
  assert.match(builtBlogsIndex, /insights/);
});

test('all governance diagrams render without runtime network dependencies', () => {
  assert.ok((article.match(/<figure class="graph"/g) || []).length >= 4);
  assert.match(article, /<ol class="pipeline">/);
  assert.match(article, /iso-pipeline/);
  assert.match(article, /aria-labelledby="us-graph-title"/);
  assert.match(article, /aria-label="On this page"/);
  assert.match(article, /<figcaption>/);
  assert.match(article, /@media\(max-width:750px\)/);
  assert.doesNotMatch(article, /<script|https?:\/\/[^"']+\.js/i);
  assert.equal((diagrams.match(/~~~mermaid/g) || []).length, 3);
  for (const token of ['flowchart TD', 'flowchart LR', 'CWG', 'LWG', 'FDIS', 'ANSI', 'INCITS/C++']) {
    assert.ok(diagrams.includes(token), 'missing Mermaid detail: ' + token);
  }
});

test('distinguishes committee consensus, ISO publication and U.S. representation', () => {
  for (const name of ['ISO/IEC 14882', 'WG21', 'ANSI', 'INCITS/C++', 'DIS ballot stage 40.20', 'October 16, 2026']) {
    assert.ok(article.includes(name), 'missing standards information: ' + name);
  }
  assert.match(article, /not yet a published International Standard/);
  assert.match(article, /not a certification/);
  assert.match(article, /https:\/\/www\.iso\.org\/standard\/91179\.html/);
  assert.match(diagrams, /not a second C\+\+26 design process/);
});
