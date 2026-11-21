import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('marketing motion is bundled locally and respects CSP', async () => {
  const layout = await read('../src/layouts/BaseLayout.astro');
  const source = await read('../src/scripts/site-motion.js');
  const pkg = JSON.parse(await read('../package.json'));
  const lock = JSON.parse(await read('../package-lock.json'));

  assert.match(layout, /<script src="\.\.\/scripts\/site-motion\.js"><\/script>/);
  assert.equal(pkg.dependencies.gsap, '3.15.1');
  assert.equal(lock.packages[''].dependencies.gsap, '3.15.1');
  assert.equal(lock.packages['node_modules/gsap'].version, '3.15.1');
  assert.match(source, /gsap\.registerPlugin\(ScrollTrigger\)/);
  assert.doesNotMatch(source, /(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
});

test('motion is progressive enhancement with a live reduced-motion exit', async () => {
  const source = await read('../src/scripts/site-motion.js');
  const stylesheet = await read('../src/styles/site-motion.css');
  const page = await read('../src/pages/index.astro');

  assert.match(source, /prefers-reduced-motion:\s*no-preference/);
  assert.match(source, /motionPreference\.add\(/);
  assert.match(source, /root\.classList\.remove\('site-motion-enabled'\)/);
  assert.match(stylesheet, /prefers-reduced-motion:\s*reduce/);
  assert.match(stylesheet, /@media print/);
  assert.match(page, /aria-hidden="true" class="readiness-signal"/);
  assert.doesNotMatch(stylesheet, /(?:^|\n)\s*\[data-motion-reveal\]\s*\{\s*opacity:\s*0/m);
});


test('focus and magnetic interactions include explicit event cleanup', async () => {
  const source = await read('../src/scripts/site-motion.js');
  assert.match(source, /group\.addEventListener\('focusin', revealOnFocus\)/);
  assert.match(source, /revealTween\.progress\(1\)/);
  assert.match(source, /revealTween\.scrollTrigger\?\.kill\(false\)/);
  assert.match(source, /revealDisposers\.forEach\(\(dispose\) => dispose\(\)\)/);
  assert.match(source, /button\.addEventListener\('pointerenter', onEnter\)/);
  assert.match(source, /button\.removeEventListener\('pointerenter', onEnter\)/);
  assert.match(source, /Math\.max\(-5, Math\.min\(5, dx \* 10\)\)/);
});


test('GSAP tarball is integrity-pinned and CSS reduced-motion never hides content', async () => {
  const lock = JSON.parse(await read('../package-lock.json'));
  const gsapPackage = lock.packages['node_modules/gsap'];
  assert.equal(gsapPackage.version, '3.15.1');
  assert.equal(gsapPackage.resolved, 'https://registry.npmjs.org/gsap/-/gsap-3.15.1.tgz');
  assert.equal(gsapPackage.integrity, 'sha512-63yjWRFWj3QRP1UOuD8kcidCcy3nxb1mMRpwHr/xJRvPfm9GtWOXFAYUiL0ro1fgPq2nY53LR+98pAgy9BumBg==');
  const css = await read('../src/styles/global.css');
  const reduced = css.split('@media (prefers-reduced-motion: reduce)')[1];
  assert.ok(reduced, 'reduced motion must have a dedicated CSS policy');
  assert.match(reduced, /animation:\s*none\s*!important/);
  assert.match(reduced, /transition:\s*none\s*!important/);
});
