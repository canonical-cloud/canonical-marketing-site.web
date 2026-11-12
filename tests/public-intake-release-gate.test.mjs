import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderReleaseRevision } from '../scripts/stamp-public-intake-release.mjs';
import { verifyIntakeRelease, validateRef, projectRefFromPublicUrl } from '../scripts/verify-intake-release.mjs';
import { releaseRevision } from '../supabase/functions/public-intake/release-revision.mjs';

const ref = 'abcdefghijklmnopqrst';
const sha = 'a'.repeat(40);
const endpoint = `https://${ref}.supabase.co/functions/v1/public-intake`;

const response = (status, headers = {}) => ({
  status, url: endpoint, headers: new Headers(headers),
});
const head = (revision = sha) => response(204, {
  'x-canonical-intake-revision': revision,
  'x-canonical-intake-contract': 'quote-seven-scope-v1',
  'access-control-allow-origin': 'https://canonical.plus',
  'cache-control': 'no-store, max-age=0',
  'x-content-type-options': 'nosniff',
});
const options = () => response(204, {
  'access-control-allow-origin': 'https://canonical.plus',
  'access-control-allow-methods': 'POST, OPTIONS',
});

test('manual release workflow pins a reviewed Supabase CLI version rather than latest v3', () => {
  const workflow = readFileSync(new URL('../.github/workflows/public-intake-release.yml', import.meta.url), 'utf8');
  assert.match(workflow, /version: '2\.122\.1'/);
  assert.match(workflow, /Unapproved Supabase CLI release/);
  assert.doesNotMatch(workflow, /version: latest/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
});

test('source releases cannot claim a deployment before the approved stamp', () => {
  assert.equal(releaseRevision, 'unreleased');
  assert.equal(renderReleaseRevision(sha).includes(`releaseRevision = '${sha}'`), true);
  for (const invalid of ['', 'refs/heads/main', 'a'.repeat(39), 'A'.repeat(40), 'abc\nxyz']) {
    assert.throws(() => renderReleaseRevision(invalid), /exact lowercase/);
  }
});

test('verified deployed source is a side-effect-free HEAD plus OPTIONS exchange', async () => {
  const requests = [];
  const result = await verifyIntakeRelease({
    projectRef: ref,
    expectedSha: sha,
    fetchImpl: async (url, init) => {
      requests.push({ url, method: init.method, origin: init.headers.origin, redirect: init.redirect });
      return init.method === 'HEAD' ? head() : options();
    },
  });
  assert.equal(result.revision, sha);
  assert.deepEqual(requests, [
    { url: endpoint, method: 'HEAD', origin: 'https://canonical.plus', redirect: 'manual' },
    { url: endpoint, method: 'OPTIONS', origin: 'https://canonical.plus', redirect: 'manual' },
  ]);
  assert.ok(requests.every((r) => r.method !== 'POST'));
});

test('read-only verification rejects stale revisions, missing headers, redirects and wrong CORS', async () => {
  for (const bad of [
    head('b'.repeat(40)),
    response(405),
    response(204, { 'x-canonical-intake-revision': sha }),
    response(204, {
      'x-canonical-intake-revision': sha,
      'x-canonical-intake-contract': 'quote-seven-scope-v1',
      'access-control-allow-origin': '*',
    }),
    { ...head(), url: 'https://example.invalid/redirect' },
  ]) {
    await assert.rejects(() => verifyIntakeRelease({
      projectRef: ref, expectedSha: sha, fetchImpl: async () => bad,
    }), /deployed/);
  }
  await assert.rejects(() => verifyIntakeRelease({
    projectRef: ref, expectedSha: sha, fetchImpl: async (_, request) => request.method === 'HEAD'
      ? head()
      : response(403),
  }), /CORS preflight/);
  for (const badRef of ['https://example.invalid', 'wrong', ref.toUpperCase(), 'a'.repeat(21)]) {
    assert.throws(() => validateRef(badRef), /invalid Supabase/);
  }
});

test('server attestation precedes all writes and cannot report an arbitrary env revision', () => {
  const source = readFileSync(new URL('../supabase/functions/public-intake/index.ts', import.meta.url), 'utf8');
  assert.match(source, /import \{ releaseRevision \} from '\.\/release-revision\.mjs'/);
  const headPosition = source.indexOf("request.method === 'HEAD'");
  const postPosition = source.indexOf("request.method !== 'POST'");
  const backendPosition = source.indexOf("const supabaseUrl = Deno.env.get");
  assert.ok(headPosition > 0 && headPosition < postPosition && postPosition < backendPosition);
  assert.match(source, /'x-canonical-intake-contract': 'quote-seven-scope-v1'/);
  assert.match(source, /'x-canonical-intake-revision': releaseRevision/);
  assert.match(source, /json\(422, \{ error: 'custom_scope_required' \}, origin\)/);
});

test('public marketing origin must bind to a single exact Supabase project', () => {
  const ref = 'abcdefghijklmnopqrst';
  assert.equal(projectRefFromPublicUrl(`https://${ref}.supabase.co`), ref);
  assert.equal(projectRefFromPublicUrl(`https://${ref}.supabase.co/`), ref);
  for (const bad of [
    '', 'https://example.com', 'http://abcdefghijklmnopqrst.supabase.co',
    'https://evil.example.com/abcdefghijklmnopqrst.supabase.co',
    'https://abcdefghijklmnopqrst.supabase.co.evil.test',
    'https://ABCDEFGHIJKLMNOPQRST.supabase.co',
    'https://short.supabase.co',
    'https://abcdefghijklmnopqrst.supabase.co/path',
    'https://abcdefghijklmnopqrst.supabase.co/?redirect=https://bad.test',
    'https://abcdefghijklmnopqrst.supabase.co#fragment',
    'https://abcdefghijklmnopqrst.supabase.co:8443',
  ]) assert.throws(() => projectRefFromPublicUrl(bad), /PUBLIC_SUPABASE_URL/);
});

test('Pages must attest the exact reviewed Edge contract before publishing enabled quote delivery', () => {
  const pages = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  const verifier = pages.indexOf('name: Verify live Edge contract before enabling public quote email');
  const publisher = pages.indexOf('name: Upload GitHub Pages artifact');
  const deploy = pages.indexOf('name: Deploy GitHub Pages artifact');
  assert.ok(verifier > 0 && publisher > verifier && deploy > publisher,
    'verified deployment must precede artifacts and deployment');
  assert.ok(pages.includes("CANONICAL_EXPECTED_RELEASE_SHA: ${{ github.event_name == 'workflow_dispatch' && inputs.approved_sha || github.event.workflow_run.head_sha }}"));
  assert.match(pages, /projectRefFromPublicUrl\(process\.env\.PUBLIC_SUPABASE_URL\)/);
  assert.match(pages, /node scripts\/verify-intake-release\.mjs/);
  assert.match(pages, /Public intake not configured: quote\/contact email disabled/);
  assert.match(pages, /github\.event\.workflow_run\.conclusion == 'success'/);
});
