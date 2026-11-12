import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validatePagesCiReceipt, verifyPagesCiRelease } from '../scripts/verify-pages-ci.mjs';

const repository = 'canonical-cloud/canonical-marketing-site.web';
const approvedSha = 'a'.repeat(40);
const ciRunId = '12345678';
const run = {
  id: Number(ciRunId),
  name: 'ci', head_sha: approvedSha, event: 'push', head_branch: 'main',
  status: 'completed', conclusion: 'success',
  run_attempt: 1, repository: { full_name: repository },
};
const job = (name, stepNames) => ({
  name, status: 'completed', conclusion: 'success', head_sha: approvedSha, run_attempt: 1,
  steps: stepNames.map((stepName) => ({
    name: stepName, status: 'completed', conclusion: 'success',
  })),
});
const jobs = [
  job('build', ['Run npm test', 'Run npm run build']),
  job('browser-e2e', ['Browser e2e (Playwright + Puppeteer)']),
  job('container-browser-e2e', [
    'Build deployable image', 'Browser security contract against deployable image',
  ]),
];

test('manual Pages release requires exact-main successful executed Node, browser and container evidence', () => {
  assert.deepEqual(
    validatePagesCiReceipt({ run, jobs, repository, approvedSha }),
    { revision: approvedSha, ciRunId: Number(ciRunId),
      verifiedJobs: ['build', 'browser-e2e', 'container-browser-e2e'] },
  );
});

test('manual Pages CI receipt fails closed on forged, stale, skipped or zero-step evidence', () => {
  const check = (overrides = {}) => validatePagesCiReceipt({
    run, jobs, repository, approvedSha, ...overrides,
  });
  for (const variant of [
    { name: 'security-audit' },
    { head_sha: 'b'.repeat(40) },
    { event: 'pull_request' },
    { head_branch: 'feature/quote' },
    { status: 'queued' },
    { conclusion: 'failure' },
    { repository: { full_name: 'other-org/other-repo' } },
  ]) assert.throws(() => check({ run: { ...run, ...variant } }), /CI receipt/);

  assert.throws(() => check({ jobs: [] }), /missing executed/);
  assert.throws(() => check({ jobs: [jobs[0], jobs[1], jobs[1]] }), /missing.*job/);
  for (const name of ['build', 'browser-e2e', 'container-browser-e2e']) {
    const altered = jobs.map((j) => j.name === name
      ? { ...j, steps: [] }
      : j);
    assert.throws(() => check({ jobs: altered }), /lacks executed/);
  }
  assert.throws(() => check({ jobs: jobs.map(j => ({ ...j, run_attempt: 2 })) }), /stale/);
  assert.throws(() => check({ jobs: jobs.map(j => ({ ...j, conclusion: 'skipped' })) }), /unsuccessful/);
  assert.throws(() => check({ jobs: jobs.map(j => ({ ...j, head_sha: 'b'.repeat(40) })) }), /stale/);
});

test('manual CI verifier fetches only read-only GitHub Actions receipts and rejects incomplete pages', async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, method: init.method, authorized: init.headers.authorization === 'Bearer fixture-token' });
    return new Response(JSON.stringify(url.includes('/jobs?')
      ? { total_count: jobs.length, jobs }
      : run), { status: 200 });
  };
  const result = await verifyPagesCiRelease({
    repository, approvedSha, ciRunId, token: 'fixture-token', fetchImpl,
  });
  assert.deepEqual(result.verifiedJobs, ['build', 'browser-e2e', 'container-browser-e2e']);
  assert.equal(requests.length, 2);
  assert.ok(requests.every(r => r.method === 'GET' && r.authorized));
  assert.ok(requests[0].url.endsWith('/actions/runs/' + ciRunId));
  assert.ok(requests[1].url.includes('/actions/runs/' + ciRunId + '/jobs?'));
  await assert.rejects(() => verifyPagesCiRelease({
    repository, approvedSha, ciRunId, token: 'fixture-token',
    fetchImpl: async (url) => new Response(JSON.stringify(url.includes('/jobs?')
      ? { total_count: 4, jobs } : run), { status: 200 }),
  }), /incomplete CI job/);
  for (const bad of [
    { approvedSha: 'refs/heads/main' }, { repository: 'not/a/path/but/many' },
    { ciRunId: '01' }, { token: '' },
  ]) {
    await assert.rejects(() => verifyPagesCiRelease({
      repository, approvedSha, ciRunId, token: 'fixture-token', fetchImpl, ...bad,
    }), /requires exact repository/);
  }
});

test('Pages manual release keeps protected main-only confirmation and exact CI/Edge gates', () => {
  const pages = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  assert.match(pages, /workflow_dispatch:/);
  assert.match(pages, /confirmation == 'PUBLISH_CANONICAL_SITE'/);
  assert.match(pages, /github\.ref == 'refs\/heads\/main'/);
  assert.match(pages, /node scripts\/verify-pages-ci\.mjs/);
  assert.match(pages, /test "\$\(git rev-parse HEAD\)" = "\$CANONICAL_APPROVED_SHA"/);
  assert.match(pages, /CANONICAL_EXPECTED_RELEASE_SHA:/);
  assert.match(pages, /node scripts\/verify-intake-release\.mjs/);
  assert.match(pages, /name: Deploy GitHub Pages artifact/);
  assert.match(pages, /github\.event\.workflow_run\.conclusion == 'success'/);
});
