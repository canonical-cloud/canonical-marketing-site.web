import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderReleaseRevision } from '../scripts/stamp-public-intake-release.mjs';
import { verifyIntakeRelease, validateRef } from '../scripts/verify-intake-release.mjs';
import { releaseRevision } from '../supabase/functions/public-intake/release-revision.mjs';

const ref = 'abcdefghijklmnopqrst';
const sha = 'a'.repeat(40);
const endpoint = `https://${ref}.supabase.co/functions/v1/public-intake`;

const response = (status, headers = {}) => ({
  status, url: endpoint, headers: new Headers(headers),
});
const head = (revision = sha) => response(204, {
  'x-canonical-intake-revision': revision,
  'x-canonical-intake-contract': 'fedramp-custom-scope-v1',
  'access-control-allow-origin': 'https://canonical.plus',
  'cache-control': 'no-store, max-age=0',
  'x-content-type-options': 'nosniff',
});
const options = () => response(204, {
  'access-control-allow-origin': 'https://canonical.plus',
  'access-control-allow-methods': 'POST, OPTIONS',
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
      'x-canonical-intake-contract': 'fedramp-custom-scope-v1',
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
  assert.match(source, /'x-canonical-intake-contract': 'fedramp-custom-scope-v1'/);
  assert.match(source, /'x-canonical-intake-revision': releaseRevision/);
  assert.match(source, /json\(422, \{ error: 'custom_scope_required' \}, origin\)/);
});
