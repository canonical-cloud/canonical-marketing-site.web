import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const page = await readFile(new URL("../src/pages/index.astro", import.meta.url), "utf8");
const readiness = await readFile(new URL("../src/pages/readiness.astro", import.meta.url), "utf8");
const frameworks = await readFile(new URL("../src/pages/frameworks.astro", import.meta.url), "utf8");
const compare = await readFile(new URL("../src/pages/compare.astro", import.meta.url), "utf8");
const layout = await readFile(new URL("../src/layouts/BaseLayout.astro", import.meta.url), "utf8");
const globalCss = await readFile(new URL("../src/styles/global.css", import.meta.url), "utf8");
const marketingCss = await readFile(new URL("../src/styles/marketing-pages.css", import.meta.url), "utf8");
const siteScript = await readFile(new URL("../public/site.js", import.meta.url), "utf8");

test("landing page keeps the readiness services visible", () => {
  for (const label of [
    "Readiness assessment",
    "Technical remediation roadmap",
    "Evidence operations",
    "Independent-review handoff",
  ]) {
    assert.ok(page.includes(label), `missing readiness service: ${label}`);
  }
});

test("framework catalog covers the approved readiness portfolio", () => {
  for (const framework of [
    "SOC 2",
    "ISO/IEC 27001",
    "HIPAA",
    "GDPR",
    "NIST CSF 2.0",
    "NIST SP 800-53",
    "PCI DSS 4.0.1",
    "FedRAMP",
    "CMMC 2.0",
    "CIS Controls v8.1",
    "CSA Cloud Controls Matrix / STAR",
    "ISO/IEC 27701",
    "NIS2",
    "DORA",
  ]) {
    assert.ok(frameworks.includes(framework), `missing framework: ${framework}`);
  }
});

test("primary calls to action stay on reviewed boundaries", () => {
  assert.match(page, /href=\{quoteHref\}/);
  assert.match(page, /href=\{readinessHref\}/);
  assert.match(page, /href="mailto:compliance@canonical\.cloud"/);
  assert.doesNotMatch([page, readiness, frameworks, compare, layout].join("\n"), /javascript:/i);
});

test("layout keeps production metadata and viewport controls", () => {
  assert.match(layout, /<html lang="en">/);
  assert.match(layout, /name="viewport"/);
  assert.match(layout, /name="description"/);
  assert.match(layout, /property="og:title"/);
  assert.match(layout, /property="og:description"/);
  assert.match(layout, /name="twitter:card"/);
  assert.match(layout, /<title>\{title\} \| canonical\.cloud<\/title>/);
  assert.match(compare, /target="_blank" rel="noopener noreferrer"/);
});

test("static image supplies the same defensive headers as the server fallback", async () => {
  const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");
  const nginx = await readFile(new URL("../nginx.conf", import.meta.url), "utf8");

  assert.match(dockerfile, /COPY nginx\.conf \/etc\/nginx\/conf\.d\/default\.conf/);
  for (const header of [
    "Content-Security-Policy",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "X-Frame-Options",
    "Permissions-Policy",
    "Cross-Origin-Opener-Policy",
  ]) {
    assert.match(nginx, new RegExp(`add_header ${header}`));
  }
  assert.match(nginx, /script-src 'self';/);
  assert.doesNotMatch(nginx, /script-src 'self' 'unsafe-inline'/);
});

test("production image inputs are pinned and test browsers never enter the artifact", async () => {
  const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");

  assert.match(dockerfile, /^FROM node:22-slim@sha256:[0-9a-f]{64} AS build$/m);
  assert.match(dockerfile, /^FROM nginx:1\.27-alpine@sha256:[0-9a-f]{64}$/m);
  assert.match(dockerfile, /PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1/);
  assert.match(dockerfile, /PUPPETEER_SKIP_DOWNLOAD=true/);
  assert.match(dockerfile, /^RUN npm ci$/m);
  assert.doesNotMatch(dockerfile, /npm ci\s*\|\|\s*npm install/);
});

test("layout keeps base-aware links so every page works behind a gateway prefix", () => {
  assert.match(layout, /import\.meta\.env\.BASE_URL/);
  for (const name of ["homeHref", "readinessHref", "frameworksHref", "compareHref", "siteScriptHref"]) {
    assert.match(layout, new RegExp(`const ${name} = `));
  }
});

test("source assets do not require third-party CSP exceptions", () => {
  for (const css of [globalCss, marketingCss]) {
    assert.doesNotMatch(css, /@import\s+(?:url\()?['"]?https?:\/\//i);
    assert.doesNotMatch(css, /url\(\s*['"]?(?:https?:|\/\/|blob:)/i);
  }
  assert.match(layout, /<script type="module" src=\{siteScriptHref\}><\/script>/);
  assert.doesNotMatch(layout, /\son[a-z]+\s*=/i);
});

test("nav exposes the readiness-first information architecture", () => {
  for (const label of ["Readiness", "Process", "Frameworks", "Compare"]) {
    assert.ok(layout.includes(`>${label}<`), `missing nav link: ${label}`);
  }
});

test("skip navigation and named landmarks exist before JavaScript runs", () => {
  assert.match(layout, /<a class="skip-link" href="#main-content">Skip to main content<\/a>/);
  assert.match(layout, /<nav class="nav" id="main-nav" aria-label="Primary navigation">/);
  assert.match(layout, /<main id="main-content" tabindex="-1">/);
  assert.match(layout, /<nav class="footer__columns" aria-label="Footer navigation">/);
  assert.match(layout, /\.skip-link:focus-visible\s*\{/);
  assert.match(layout, /#main-content:focus-visible\s*\{/);
  assert.match(layout, /aria-hidden="true" focusable="false"/);
  assert.match(siteScript, /mainContent\.focus\(\{ preventScroll: true \}\)/);
});

test("mobile navigation has a real open state and synchronized accessibility state", () => {
  assert.match(layout, /\.nav \.nav__links\.nav__links--open\s*\{/);
  assert.match(globalCss, /min-height:\s*44px/);
  assert.match(globalCss, /:focus-visible/);
  assert.match(globalCss, /prefers-reduced-motion:\s*reduce/);

  assert.match(layout, /id="nav-toggle"[\s\S]*type="button"/);
  assert.match(layout, /id="nav-toggle"[\s\S]*aria-controls="nav-links"/);
  assert.match(layout, /id="nav-toggle"[\s\S]*aria-expanded="false"/);
  assert.match(layout, /id="nav-toggle"[\s\S]*aria-label="Open navigation"/);

  assert.match(siteScript, /setAttribute\('aria-controls', links\.id\)/);
  assert.match(siteScript, /setAttribute\('aria-expanded', String\(nextOpen\)\)/);
  assert.match(siteScript, /Open navigation/);
  assert.match(siteScript, /Close navigation/);
  assert.match(siteScript, /event\.key === 'Escape'/);
  assert.match(siteScript, /restoreFocus:\s*true/);
  assert.match(siteScript, /matchMedia\('\(max-width: 768px\)'\)/);
});

test("quote and sign-in links use the canonical application boundary", () => {
  assert.match(siteScript, /const APP_SCHEME = 'https'/);
  assert.match(siteScript, /const APP_HOST = 'app\.canonical\.plus'/);
  assert.match(siteScript, /\[APP_SCHEME, APP_HOST\]\.join\('\:\/\/'\)/);
  assert.match(siteScript, /const READINESS_PATH = '\/u\/quote'/);
  assert.match(siteScript, /new URL\(READINESS_PATH, APP_ORIGIN\)/);
  assert.doesNotMatch(siteScript, /\/auth\/start|return_to/);
  assert.doesNotMatch(siteScript, /access_token|refresh_token|id_token/i);
});

test("comparison page states the competitive baseline without claiming parity", () => {
  for (const vendor of ["Vanta", "Drata", "Secureframe", "Sprinto", "Thoropass"]) {
    assert.ok(compare.includes(vendor), `missing comparison source: ${vendor}`);
  }
  assert.match(compare, /not positioned as a mature hundreds-of-integrations continuous-monitoring suite/);
  assert.match(compare, /No independent audit opinion, certification, authorization, or legal conclusion/);
});
