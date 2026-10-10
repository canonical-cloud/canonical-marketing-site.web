import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const brandCss = await read('../public/brand-overrides.css');
const siteScript = await read('../public/site.js');
const themeInit = await read('../public/theme-init.js');
const cloudLogo = await read('../public/brand/canonical-cloud.svg');

const themes = ['dark', 'medium', 'light'];

test('orange replaces the former magenta presentation across all adaptive themes', () => {
  for (const theme of themes) {
    assert.match(brandCss, new RegExp(`data-theme='${theme}'[\\s\\S]*--av-orange-light:`));
  }

  for (const token of ['--av-orange-light', '--av-orange', '--av-orange-dark', '--av-orange-glow', '--av-orange-border']) {
    assert.ok(brandCss.includes(token), `missing orange token: ${token}`);
  }

  assert.match(brandCss, /--av-magenta:\s*var\(--av-orange\)/);
  assert.match(brandCss, /--av-magenta-light:\s*var\(--av-orange-light\)/);
  assert.match(brandCss, /\.nav__link::after[\s\S]*var\(--av-orange\)/);
  assert.match(brandCss, /\.btn--secondary:hover[\s\S]*var\(--av-orange\)/);
  assert.match(brandCss, /\.gradient-text[\s\S]*var\(--av-orange-light\)/);
  assert.doesNotMatch(brandCss, /#(?:d946ef|e879f9|86198f|f0abfc|a21caf|701a75)/i);
});

test('brand stylesheet starts loading in the head and has a module fallback', () => {
  assert.match(themeInit, /brand-overrides\.css/);
  assert.match(themeInit, /data-canonical-brand-styles/);
  assert.match(siteScript, /brand-overrides\.css/);
  assert.match(siteScript, /data-canonical-brand-styles/);
});

test('header lockup pairs Canonical Cloud and Canonical Plus without a product badge', () => {
  assert.match(siteScript, /Canonical Cloud — canonical\.plus home/);
  assert.match(siteScript, /parentName\.textContent = 'CANONICAL CLOUD'/);
  assert.match(siteScript, /canonical-cloud\.svg/);
  assert.match(siteScript, /nav__plus-brand-name/);
  assert.doesNotMatch(siteScript, /canonical\\.plus product|nav__product-brand/i);
  assert.doesNotMatch(brandCss, /content:\\s*['"]product['"]|nav__product-brand/i);
  assert.match(brandCss, /#nav-logo:not\(\[data-brand-lockup='true'\]\)::before[\s\S]*CANONICAL CLOUD/);
  assert.match(brandCss, /#nav-logo:not\(\[data-brand-lockup='true'\]\)::before[\s\S]*canonical-cloud\.svg/);
  assert.match(brandCss, /\.nav__parent-brand-name[\s\S]*font-size:\s*0\.9rem/);
  assert.match(brandCss, /\.nav__plus-brand-name[\s\S]*font-size:\s*0\.72rem/);
  assert.match(cloudLogo, /Canonical Cloud layered C/);
});

test('headline accent spacing is explicit at the inline boundary', () => {
  assert.match(brandCss, /\.page-hero__title > \.gradient-text\s*\{[\s\S]*margin-inline-start:\s*0\.18em/);
});
