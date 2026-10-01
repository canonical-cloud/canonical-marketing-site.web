#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const [webRoot] = process.argv.slice(2);
if (!webRoot) {
  throw new Error('usage: check-application-route-authority.mjs WEB_ROOT');
}

const marketingIndex = fs.readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
const siteScript = fs.readFileSync(new URL('../public/site.js', import.meta.url), 'utf8');
const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const lock = JSON.parse(fs.readFileSync(new URL('../contracts/application-route-sources.json', import.meta.url), 'utf8'));

const docsAuthority = lock.sources.productInformationArchitecture;
const webAuthority = lock.sources.customerWebRoute;
const webRoutes = fs.readFileSync(path.join(webRoot, webAuthority.path), 'utf8');
const target = lock.canonicalTarget;
const url = new URL(target);
const sha40 = /^[0-9a-f]{40}$/;

if (url.protocol !== 'https:' || url.host !== 'app.canonical.plus' || url.pathname !== '/u/quote' || url.search || url.hash) {
  throw new Error('canonical authenticated application CTA target must be exact credential-free https://app.canonical.plus/u/quote');
}

// canonical-docs is private, while this repository is public. A pull-request
// GITHUB_TOKEN is intentionally scoped to this repository and cannot clone the
// private sibling repository. Keep the exact upstream revision/path/blob
// provenance in the lock and cache only the route admission fact needed by
// public CI. Updating this assertion requires re-verifying the pinned private
// source and recording its content-addressed Git blob SHA.
if (
  docsAuthority.repository !== 'canonical-cloud/canonical-docs' ||
  docsAuthority.path !== 'docs/market-positioning.md' ||
  !sha40.test(docsAuthority.revision) ||
  !sha40.test(docsAuthority.blobSha) ||
  !Array.isArray(docsAuthority.admittedTargets) ||
  !docsAuthority.admittedTargets.includes(target)
) {
  throw new Error('pinned product information architecture does not admit the canonical application CTA target');
}

if (webAuthority.repository !== 'canonical-cloud/canonical-web-server.rs' || !sha40.test(webAuthority.revision)) {
  throw new Error('customer web route authority must be pinned to an exact canonical-web-server.rs revision');
}
if (!webRoutes.includes('.route("/u/quote", get(quote::page).post(quote::submit))')) {
  throw new Error('customer web server does not implement GET+POST /u/quote');
}

for (const [name, source] of Object.entries({ siteScript, readme })) {
  if (!source.includes('/u/quote')) throw new Error(`${name} does not reference authenticated /u/quote`);
  if (source.includes('/u/readiness')) throw new Error(`${name} still contains obsolete /u/readiness`);
  if (/(?:access_token|refresh_token|id_token|return_to|[?&](?:token|tenant|subject|session)=)/i.test(source)) {
    throw new Error(`${name} contains credential/identity material in application-link source`);
  }
}

// The public marketing estimator is intentionally separate from the authenticated
// customer application. Visitors can build a lead/readiness estimate on canonical.plus
// without being sent into the signed-in application route.
if (!marketingIndex.includes('/quote/')) {
  throw new Error('marketingIndex does not reference the public /quote/ estimator');
}
if (marketingIndex.includes('/u/readiness')) {
  throw new Error('marketingIndex still contains obsolete /u/readiness');
}
if (/(?:access_token|refresh_token|id_token|return_to|[?&](?:token|tenant|subject|session)=)/i.test(marketingIndex)) {
  throw new Error('marketingIndex contains credential/identity material in public quote source');
}

process.stdout.write(`application-route-authority: authenticated ${target}; public estimator /quote/\n`);
