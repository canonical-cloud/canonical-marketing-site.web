import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import {
  EXPECTED_COMPANIES, TestimonialPublicationError, inspectLogoBytes,
  isLocalLogoPath, validateCandidates, verifyTestimonialPublication,
} from '../scripts/testimonial-publication.mjs';

const candidates = JSON.parse(await readFile(
  new URL('../src/data/testimonial-candidates.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(candidates);
const fixtureSvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M1 1 L20 20 Z" fill="#222"/></svg>');

const approvedFixture = () => clone().map((item) => ({
  ...item,
  approvedForPublication: true,
  quote: 'Synthetic test quote only',
  attribution: 'Synthetic test speaker',
  logoUseConsent: 'test:brand-approval',
  relationshipEvidence: 'test:relationship',
  publicationConsent: 'test:quotation-approval',
  logoAssetPath: '/brand/testimonials/' + item.id + '.svg',
}));

function hasCode(code) {
  return (error) => error instanceof TestimonialPublicationError && error.code === code;
}

test('eight configured companies and order are immutable', () => {
  assert.equal(EXPECTED_COMPANIES.length, 8);
  assert.deepEqual(candidates.map((item) => [item.id, item.company]), EXPECTED_COMPANIES);
  const changed = clone();
  [changed[0], changed[1]] = [changed[1], changed[0]];
  assert.throws(() => validateCandidates(changed), hasCode('WRONG_COMPANY_OR_ORDER'));
});

test('production remains unpublished without approved evidence', async () => {
  const result = await verifyTestimonialPublication(clone(), {
    readAsset: () => { throw new Error('unapproved assets must not be opened'); },
  });
  assert.deepEqual(result, { status: 'HIDDEN', companies: 8, assetsChecked: 0 });
});

test('rejects partial approvals before reading any image', async () => {
  const entries = clone();
  entries[0].approvedForPublication = true;
  await assert.rejects(verifyTestimonialPublication(entries), hasCode('PARTIAL_APPROVAL_BLOCKED'));
});

test('rejects URL and cross-company local asset injection', () => {
  assert.equal(isLocalLogoPath('vultr', '/brand/testimonials/vultr.svg'), true);
  for (const bad of [
    'https://example.test/logo.svg',
    '/brand/testimonials/../vultr.svg',
    '/brand/testimonials/bose-audio.svg',
    '/brand/testimonials/vultr.svg?x=1',
    '/brand/testimonials/vultr.SVG',
    '/brand/testimonials/vultr.svg%00',
  ]) assert.equal(isLocalLogoPath('vultr', bad), false);
  const entries = approvedFixture();
  entries[0].logoAssetPath = '/brand/testimonials/vultr.svg';
  assert.throws(() => validateCandidates(entries), hasCode('INVALID_LOGO_ASSET_PATH'));
});

test('missing publication evidence blocks all eight', () => {
  for (const field of [
    'quote', 'attribution', 'relationshipEvidence', 'publicationConsent', 'logoUseConsent',
  ]) {
    const entries = approvedFixture();
    entries[2][field] = null;
    assert.throws(() => validateCandidates(entries), hasCode('MISSING_PUBLICATION_EVIDENCE'));
  }
});

test('unsafe SVG payloads are blocked (no script, remote refs, styles, DTD or foreignObject)', () => {
  assert.deepEqual(inspectLogoBytes(fixtureSvg, 'svg'), {format: 'svg', bytes: fixtureSvg.length});
  for (const svg of [
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><path d="M0 0"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.test/x.png"/></svg>',
    '<!DOCTYPE svg><svg><path d="M0 0"/></svg>',
    '<svg><foreignObject><div>hello</div></foreignObject></svg>',
    '<svg><style>@import url(https://evil.test/x.css)</style></svg>',
  ]) assert.throws(() => inspectLogoBytes(Buffer.from(svg), 'svg'));
});

test('rejects fake PNG/WebP signatures and oversized assets', () => {
  assert.throws(() => inspectLogoBytes(Buffer.alloc(100), 'png'), hasCode('INVALID_PNG_HEADER'));
  assert.throws(() => inspectLogoBytes(Buffer.alloc(100), 'webp'), hasCode('INVALID_WEBP_HEADER'));
  assert.throws(() => inspectLogoBytes(Buffer.alloc(256 * 1024 + 1), 'svg'), hasCode('INVALID_LOGO_SIZE'));
});

test('blocks missing assets and symlinked logos', async () => {
  const entries = approvedFixture();
  await assert.rejects(verifyTestimonialPublication(entries, {
    statAsset: async () => { throw new Error('ENOENT'); },
  }), hasCode('LOGO_FILE_MISSING'));
  await assert.rejects(verifyTestimonialPublication(entries, {
    statAsset: async () => ({ isFile: () => true, isSymbolicLink: () => true, size: fixtureSvg.length }),
  }), hasCode('INVALID_LOGO_FILE'));
});

test('synthetic approved fixtures validate all eight local assets without publishing them', async () => {
  const result = await verifyTestimonialPublication(approvedFixture(), {
    statAsset: async () => ({isFile: () => true, isSymbolicLink: () => false, size: fixtureSvg.length}),
    canonicalPath: async (path) => resolve(path),
    readAsset: async () => fixtureSvg,
  });
  assert.deepEqual(result, {status: 'READY', companies: 8, assetsChecked: 8});
});
