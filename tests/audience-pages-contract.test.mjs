import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const slugs = ['startups', 'founders', 'sales-teams', 'technical-founders', 'vc-portfolios'];
const [home, layout, component, data, css] = await Promise.all([
  read('../src/pages/index.astro'),
  read('../src/layouts/BaseLayout.astro'),
  read('../src/components/AudienceLanding.astro'),
  read('../src/data/audiences.ts'),
  read('../src/styles/audience-pages.css'),
]);

test('every audience page has a dedicated static route, title, and description', async () => {
  for (const slug of slugs) {
    const source = await read(`../src/pages/${slug}.astro`);
    const output = await read(`../dist/${slug}/index.html`);
    assert.ok(source.includes(`audiencePages['${slug}']`), `wrong page data for ${slug}`);
    assert.match(output, /<h1\b[^>]*id="audience-heading"/);
    assert.match(output, /<meta name="description" content="[^"]+"/);
    assert.match(output, /canonical\.plus<\/title>/);
    assert.match(output, /Book an intro/);
    assert.match(output, /Build a readiness quote/);
    assert.match(output, /qualified independent/i);
  }
});

test('homepage and navigation make the new customer paths discoverable', () => {
  assert.match(home, /id="who-we-help"/);
  assert.match(home, /audienceLinks\.map/);
  assert.match(home, /Enterprise-ready security for startups/);
  assert.match(home, /href=\{startupsHref\}[^>]*id="hero-cta-secondary"/);
  assert.match(layout, /id="nav-startups">Startups<\/a>/);
  for (const slug of slugs) {
    assert.ok(data.includes(`slug: '${slug}'`), `missing persona data ${slug}`);
    if (slug !== 'startups') assert.ok(layout.includes(`/${slug}/`), `missing footer route ${slug}`);
  }
});

test('new routes respect scoped pricing, independent assurance, and supported CTAs', () => {
  assert.match(component, /const publicQuoteHref = `\$\{baseNoSlash\}\/quote\/`/);
  assert.match(component, /https:\/\/calendly\.com\/hello-canonical\/30min/);
  assert.match(component, /target="_blank" rel="noopener noreferrer"/);
  assert.match(component, /signed statement of work/);
  assert.match(component, /not independent audit opinions/);
  assert.match(data, /We do not guarantee faster deal closure/);
  assert.match(data, /do not fabricate questionnaire answers/);
  assert.doesNotMatch(data + component, /100%|guaranteed certification|certified by Canonical Plus/i);
  assert.doesNotMatch(data + component, /\$1,500|\$3,000/);
  assert.match(css, /@media \(max-width: 700px\)/);
});

test('persona pages supply distinct content rather than one generic pitch', () => {
  for (const phrase of [
    'For founders and CEOs',
    'For heads of sales and revenue',
    'For CTOs and technical co-founders',
    'For venture funds and accelerators',
    'Seed-stage and Series A teams',
  ]) assert.ok(data.includes(phrase), `missing message for ${phrase}`);
  assert.match(component, /id="outcomes"/);
  assert.match(component, /id="fit"/);
  assert.match(component, /id="questions"/);
  assert.match(component, /id="other-teams"/);
});
