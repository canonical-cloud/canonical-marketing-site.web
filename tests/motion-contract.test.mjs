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
