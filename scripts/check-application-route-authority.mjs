#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const [docsRoot, webRoot] = process.argv.slice(2);
if (!docsRoot || !webRoot) {
  throw new Error('usage: check-application-route-authority.mjs DOCS_ROOT WEB_ROOT');
}

const marketingIndex = fs.readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
const siteScript = fs.readFileSync(new URL('../public/site.js', import.meta.url), 'utf8');
const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const lock = JSON.parse(fs.readFileSync(new URL('../contracts/application-route-sources.json', import.meta.url), 'utf8'));

const docs = fs.readFileSync(path.join(docsRoot, lock.sources.productInformationArchitecture.path), 'utf8');
const webRoutes = fs.readFileSync(path.join(webRoot, lock.sources.customerWebRoute.path), 'utf8');
const target = lock.canonicalTarget;
const url = new URL(target);

if (url.protocol !== 'https:' || url.host !== 'app.canonical.plus' || url.pathname !== '/u/quote' || url.search || url.hash) {
  throw new Error('canonical CTA target must be exact credential-free https://app.canonical.plus/u/quote');
}
if (!docs.includes(target)) {
  throw new Error('active product information architecture does not admit the canonical CTA target');
}
if (!webRoutes.includes('.route("/u/quote", get(quote::page).post(quote::submit))')) {
  throw new Error('customer web server does not implement GET+POST /u/quote');
}
for (const [name, source] of Object.entries({ marketingIndex, siteScript, readme })) {
  if (!source.includes('/u/quote')) throw new Error(`${name} does not reference /u/quote`);
  if (source.includes('/u/readiness')) throw new Error(`${name} still contains obsolete /u/readiness`);
  if (/(?:access_token|refresh_token|id_token|return_to|[?&](?:token|tenant|subject|session)=)/i.test(source)) {
    throw new Error(`${name} contains credential/identity material in application-link source`);
  }
}

process.stdout.write(`application-route-authority: admitted ${target}\n`);
