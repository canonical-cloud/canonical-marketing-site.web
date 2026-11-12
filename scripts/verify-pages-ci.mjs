#!/usr/bin/env node
// Read-only GitHub Actions attestation for a manual Pages release.
// A manually entered run ID is NOT evidence until the exact main SHA, pushed
// CI result, and nonzero executed browser/build job steps all match.
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const completedStep = (job, name) =>
  Array.isArray(job.steps) && job.steps.some((step) =>
    step.name === name && step.status === 'completed' && step.conclusion === 'success');

const requiredJobs = new Map([
  ['build', ['Run npm test', 'Run npm run build']],
  ['browser-e2e', ['Browser e2e (Playwright + Puppeteer)']],
  ['container-browser-e2e', ['Build deployable image', 'Browser security contract against deployable image']],
]);

export const validatePagesCiReceipt = ({ run, jobs, repository, approvedSha }) => {
  if (!run || run.name !== 'ci' || run.head_sha !== approvedSha ||
      run.event !== 'push' || run.head_branch !== 'main' ||
      run.status !== 'completed' || run.conclusion !== 'success' ||
      run.repository?.full_name !== repository) {
    throw new Error('CI receipt does not prove a successful main push at the exact approved SHA');
  }
  if (!Array.isArray(jobs) || jobs.length < requiredJobs.size) {
    throw new Error('CI receipt has missing executed job records');
  }
  for (const [name, steps] of requiredJobs) {
    const matches = jobs.filter((job) => job.name === name);
    if (matches.length !== 1 ||
        matches[0].status !== 'completed' || matches[0].conclusion !== 'success' ||
        (matches[0].head_sha && matches[0].head_sha !== approvedSha) ||
        (matches[0].run_attempt && matches[0].run_attempt !== run.run_attempt)) {
      throw new Error('CI receipt has a missing, stale, duplicated or unsuccessful job: ' + name);
    }
    for (const stepName of steps) {
      if (!completedStep(matches[0], stepName)) {
        throw new Error('CI job lacks executed successful application test step: ' + name + '/' + stepName);
      }
    }
  }
  return { revision: approvedSha, ciRunId: run.id, verifiedJobs: [...requiredJobs.keys()] };
};

export const verifyPagesCiRelease = async ({
  repository, approvedSha, ciRunId, token,
  fetchImpl = fetch, apiBase = 'https://api.github.com',
}) => {
  if (typeof repository !== 'string' ||
      !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository) ||
      typeof approvedSha !== 'string' || !/^[0-9a-f]{40}$/.test(approvedSha) ||
      typeof ciRunId !== 'string' || !/^[1-9][0-9]*$/.test(ciRunId) ||
      typeof token !== 'string' || !token.length) {
    throw new Error('Manual Pages release requires exact repository, main SHA, numeric CI run and read-only token');
  }
  const headers = {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
  };
  const get = async (url) => {
    const response = await fetchImpl(url, {
      method: 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error('GitHub CI receipt lookup failed: ' + response.status);
    return response.json();
  };
  const base = `${apiBase.replace(/\/$/, '')}/repos/${repository}/actions/runs/${ciRunId}`;
  const run = await get(base);
  // Reject mismatched run before looking up its jobs.
  if (run.head_sha !== approvedSha || run.name !== 'ci' ||
      run.event !== 'push' || run.head_branch !== 'main' ||
      run.status !== 'completed' || run.conclusion !== 'success' ||
      run.repository?.full_name !== repository) {
    throw new Error('GitHub CI run does not match approved successful main push');
  }
  const page = await get(`${base}/jobs?per_page=100&filter=latest`);
  if (!page || !Array.isArray(page.jobs) || page.total_count !== page.jobs.length) {
    // Do not trust partial/paginated lists; skip is not a passing job.
    throw new Error('GitHub returned an incomplete CI job receipt');
  }
  return validatePagesCiReceipt({ run, jobs: page.jobs, repository, approvedSha });
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyPagesCiRelease({
    repository: process.env.GITHUB_REPOSITORY,
    approvedSha: process.env.CANONICAL_APPROVED_SHA,
    ciRunId: process.env.CANONICAL_CI_RUN_ID,
    token: process.env.GITHUB_TOKEN,
    apiBase: process.env.GITHUB_API_URL || 'https://api.github.com',
  }).then((result) => {
    process.stdout.write(`Approved main CI verified: ${result.revision} / run ${result.ciRunId} / ${result.verifiedJobs.join(', ')}\n`);
  }).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
