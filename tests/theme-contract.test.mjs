import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const layout = await readFile(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');
const globalCss = await readFile(new URL('../src/styles/global.css', import.meta.url), 'utf8');
const themeInit = await readFile(new URL('../public/theme-init.js', import.meta.url), 'utf8');
const siteScript = await readFile(new URL('../public/site.js', import.meta.url), 'utf8');

const runThemeInitializer = ({ hour, storedPreference = null }) => {
  const values = new Map();
  if (storedPreference !== null) {
    values.set('canonical-theme', storedPreference);
  }

  const themeColor = {
    content: null,
    setAttribute(name, value) {
      if (name === 'content') {
        this.content = value;
      }
    },
  };

  class LocalDate extends Date {
    getHours() {
      return hour;
    }
  }

  const context = {
    Date: LocalDate,
    document: {
      documentElement: { dataset: {}, style: {} },
      querySelector(selector) {
        return selector === 'meta[name="theme-color"]' ? themeColor : null;
      },
    },
    window: {
      localStorage: {
        getItem(key) {
          return values.get(key) ?? null;
        },
        removeItem(key) {
          values.delete(key);
        },
        setItem(key, value) {
          values.set(key, value);
        },
      },
    },
  };

  vm.runInNewContext(themeInit, context);
  return { ...context, themeColor, values };
};

test('header and footer expose synchronized auto, light, medium, and dark controls', () => {
  assert.equal((layout.match(/data-theme-switcher/g) ?? []).length, 2);

  for (const choice of ['auto', 'light', 'medium', 'dark']) {
    assert.equal(
      (layout.match(new RegExp(`data-theme-choice="${choice}"`, 'g')) ?? []).length,
      2,
      `expected ${choice} in both switchers`,
    );
  }

  assert.match(layout, /theme-init\.js/);
  assert.match(layout, /<script src=\{themeInitScriptHref\}><\/script>/);
  assert.match(siteScript, /setAttribute\('aria-pressed', String\(selected\)\)/);
  assert.match(siteScript, /themeController\.apply\(button\.dataset\.themeChoice, \{ persist: true \}\)/);
});

test('all three palettes define their own accessible color system', () => {
  for (const theme of ['dark', 'medium', 'light']) {
    assert.match(globalCss, new RegExp(`:root\\[data-theme='${theme}'\\]`));
  }

  for (const token of [
    '--av-bg',
    '--av-surface',
    '--av-text-primary',
    '--av-text-secondary',
    '--av-nav-bg',
    '--av-footer-bg',
    '--av-theme-active-bg',
  ]) {
    assert.ok(globalCss.includes(token), `missing adaptive token: ${token}`);
  }
});

test('automatic theme resolves against browser-local time', () => {
  const morning = runThemeInitializer({ hour: 9 });
  assert.equal(morning.document.documentElement.dataset.theme, 'light');
  assert.equal(morning.document.documentElement.dataset.themePreference, 'auto');
  assert.equal(morning.themeColor.content, '#f3f7f5');

  const dusk = runThemeInitializer({ hour: 18 });
  assert.equal(dusk.document.documentElement.dataset.theme, 'medium');
  assert.equal(dusk.themeColor.content, '#172033');

  const night = runThemeInitializer({ hour: 23 });
  assert.equal(night.document.documentElement.dataset.theme, 'dark');
  assert.equal(night.themeColor.content, '#0a0f1a');
});

test('manual preference wins until the user returns to automatic mode', () => {
  const context = runThemeInitializer({ hour: 10, storedPreference: 'dark' });
  const root = context.document.documentElement;

  assert.equal(root.dataset.theme, 'dark');
  assert.equal(root.dataset.themePreference, 'dark');

  context.window.canonicalTheme.apply('medium', { persist: true });
  assert.equal(root.dataset.theme, 'medium');
  assert.equal(context.values.get('canonical-theme'), 'medium');

  context.window.canonicalTheme.apply('auto', { persist: true });
  assert.equal(root.dataset.theme, 'light');
  assert.equal(context.values.has('canonical-theme'), false);
});

test('invalid stored preferences fail closed to local-time automatic mode', () => {
  const context = runThemeInitializer({ hour: 7, storedPreference: 'neon' });
  assert.equal(context.document.documentElement.dataset.themePreference, 'auto');
  assert.equal(context.document.documentElement.dataset.theme, 'medium');
});
