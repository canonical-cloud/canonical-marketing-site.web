#!/usr/bin/env node
// Public, read-only post-deploy verification. HEAD + OPTIONS only.
// In particular, this code MUST NEVER submit a synthetic quote: a stale
// deployment could persist or email it before its new FedRAMP guard is live.
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const validateRef = (projectRef) => {
  if (typeof projectRef !== 'string' || !/^[a-z0-9]{20}$/.test(projectRef)) {
    throw new Error('invalid Supabase project reference: expected exact project id');
  }
  return projectRef;
};

export const verifyIntakeRelease = async ({
  projectRef, expectedSha, fetchImpl = fetch,
}) => {
  validateRef(projectRef);
  if (typeof expectedSha !== 'string' || !/^[0-9a-f]{40}$/.test(expectedSha)) {
    throw new Error('expected revision must be an exact lowercase Git commit SHA');
  }
  const url = `https://${projectRef}.supabase.co/functions/v1/public-intake`;
  const request = (method) => fetchImpl(url, {
    method,
    headers: { origin: 'https://canonical.plus' },
    redirect: 'manual',
    signal: AbortSignal.timeout(12000),
  });
  const head = await request('HEAD');
  if (head.status !== 204 || head.url && head.url !== url) {
    throw new Error('deployed function HEAD attestation unavailable or redirected');
  }
  if (head.headers.get('x-canonical-intake-revision') !== expectedSha) {
    throw new Error('deployed function revision does not match reviewed main commit');
  }
  if (head.headers.get('x-canonical-intake-contract') !== 'fedramp-custom-scope-v1') {
    throw new Error('deployed public quote contract is missing or unexpected');
  }
  if (head.headers.get('access-control-allow-origin') !== 'https://canonical.plus' ||
      !/^no-store\b/.test(head.headers.get('cache-control') || '') ||
      head.headers.get('x-content-type-options') !== 'nosniff') {
    throw new Error('deployed attestation violates CORS or no-store security policy');
  }
  const options = await request('OPTIONS');
  if (options.status !== 204 || options.url && options.url !== url ||
      options.headers.get('access-control-allow-origin') !== 'https://canonical.plus' ||
      !/POST/.test(options.headers.get('access-control-allow-methods') || '')) {
    throw new Error('deployed function CORS preflight failed or redirected');
  }
  return { projectRef, revision: expectedSha, contract: 'fedramp-custom-scope-v1' };
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyIntakeRelease({
    projectRef: process.env.SUPABASE_PROJECT_REF,
    expectedSha: process.env.CANONICAL_EXPECTED_RELEASE_SHA,
  }).then((result) => {
    process.stdout.write(`Public intake deployment verified (read-only): revision ${result.revision}, contract ${result.contract}\n`);
  }).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
