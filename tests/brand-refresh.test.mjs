import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const brandCss = await read('../public/brand-refresh.css');
const siteScript = await read('../public/site.js');
const home = await read('../src/pages/index.astro');
const compare = await read('../src/pages/compare.astro');
const people = await read('../src/pages/people.astro');

test('orange replaces the visible editorial accent across all adaptive themes', () => {
  for (const token of [
    '--av-orange:',
    '--av-orange-light:',
    '--av-orange-dark:',
    '--av-orange-glow:',
    '--av-orange-border:',
  ]) {
    assert.ok(brandCss.includes(token), `missing orange brand token: ${token}`);
  }

  assert.match(brandCss, /:root\[data-theme='medium'\]/);
  assert.match(brandCss, /:root\[data-theme='light'\]/);
  assert.match(brandCss, /--av-magenta:\s*var\(--av-orange\)/);
  assert.match(brandCss, /--av-magenta-light:\s*var\(--av-orange-light\)/);
  assert.match(brandCss, /--av-magenta-dark:\s*var\(--av-orange-dark\)/);
});

test('header presents Canonical Cloud as parent and Canonical Plus as product', () => {
  assert.match(brandCss, /#nav-logo::before[\s\S]*content:\s*'CANONICAL CLOUD'/);
  assert.match(brandCss, /canonical-cloud-logo\.png/);
  assert.match(brandCss, /#nav-logo \.nav__logo-text::before[\s\S]*content:\s*'PRODUCT'/);
  assert.match(siteScript, /brand-refresh\.css/);
  assert.match(siteScript, /Canonical Cloud — Canonical Plus product home/);
  assert.match(siteScript, /Canonical Plus is the compliance-readiness product from Canonical Cloud/);
  assert.match(home, /Canonical Plus is the readiness product from Canonical Cloud/);
  assert.match(people, /Canonical Plus is a Canonical Cloud product/);
});

test('split hero emphasis keeps explicit word spacing', () => {
  assert.match(home, /between you and\{' '\}[\s\S]*audit-ready/);
  assert.match(compare, /substitute for\{' '\}[\s\S]*automation or independent assurance/);
});
