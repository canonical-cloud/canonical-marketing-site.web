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
    "ISO 22301",
    "CSA Cloud Controls Matrix / STAR",
    "ISO/IEC 27701",
    "NIS2",
    "DORA",
  ]) {
    assert.ok(frameworks.includes(framework), `missing framework: ${framework}`);
  }
});

test("primary calls to action stay on reviewed boundaries", () => {
  const publicSources = [page, readiness, frameworks, compare, layout].join("\n");
  assert.match(page, /href=\{quoteHref\}/);
  assert.match(page, /href=\{readinessHref\}/);
  assert.match(page, /href="mailto:hello@canonical\.plus"/);
  assert.match(frameworks, /href="mailto:hello@canonical\.plus"/);
  assert.match(compare, /href="mailto:hello@canonical\.plus"/);
  assert.doesNotMatch(publicSources, /compliance@canonical\.(?:plus|cloud)/i);
  assert.doesNotMatch(publicSources, /javascript:/i);
});

test("layout keeps production metadata and viewport controls", () => {
  assert.match(layout, /<html lang="en"[^>]*>/);
  assert.match(layout, /name="viewport"/);
  assert.match(layout, /name="description"/);
  assert.match(layout, /property="og:title"/);
  assert.match(layout, /property="og:description"/);
  assert.match(layout, /name="twitter:card"/);
  assert.match(layout, /<title>\{title\} \| canonical\.plus<\/title>/);
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

  assert.match(dockerfile, /^FROM node:22\.23\.4-slim@sha256:[0-9a-f]{64} AS build$/m);
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

test("footer presents Canonical Cloud and Canonical Plus as distinct brand lockups", () => {
  assert.match(layout, /const canonicalCloudHref = 'https:\/\/canonical-cloud\.github\.io\/'/);
  assert.match(layout, /aria-label="Canonical Cloud home"/);
  assert.match(layout, /class="canonical-cloud-mark"/);
  assert.match(layout, /Canonical Cloud provides the operating platform/);
  assert.match(layout, /aria-label="Canonical Plus home"/);
  assert.match(layout, />CANONICAL<\/span><span class="nav__logo-compliance">\.PLUS<\/span>/);
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

test("quote links use the supported customer quote boundary and sign-in stays hidden until supported", () => {
  assert.match(siteScript, /const APP_SCHEME = 'https'/);
  assert.match(siteScript, /const APP_HOST = 'app\.canonical\.plus'/);
  assert.match(siteScript, /\[APP_SCHEME, APP_HOST\]\.join\('\:\/\/'\)/);
  assert.match(siteScript, /const QUOTE_PATH = '\/u\/quote'/);
  assert.match(siteScript, /new URL\(QUOTE_PATH, APP_ORIGIN\)/);
  assert.doesNotMatch(siteScript, /signInUrl|nav-sign-in|sign-in/);
  assert.doesNotMatch(layout, /Sign in|nav-sign-in|data-application-link="sign-in"/i);
  assert.doesNotMatch(siteScript, /\/u\/readiness/);
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


test("FAQ page includes 68 distinct customer questions with transparent assurance boundaries", async () => {
  const faq = await readFile(new URL("../src/pages/faq.astro", import.meta.url), "utf8");
  const ids = [...faq.matchAll(/"id": "faq-([a-z0-9-]+)"/g)].map((match) => match[1]);
  const questions = [...faq.matchAll(/"question":/g)];
  assert.equal(ids.length, 68, "expected 68 FAQ item anchors");
  assert.equal(new Set(ids).size, 68, "FAQ item anchors must be unique");
  assert.equal(questions.length, 68, "expected 68 customer-facing questions");
  for (const group of ["why-readiness", "why-canonical", "buying-process", "getting-started", "framework-details", "engineering-controls", "evidence-workflows", "working-together"]) {
    assert.ok(faq.includes('"id": "' + group + '"'), 'missing group ' + group);
  }
  for (const boundary of ["We do not issue audit opinions", "independent reviewer", "statement of work"]) {
    assert.ok(faq.includes(boundary), 'missing FAQ boundary ' + boundary);
  }
  assert.match(faq, /<details class="faq-item" id=\{item\.id\}>/);
  assert.match(faq, /<summary class="faq-item__question">/);
  assert.match(faq, /const quoteHref =/);
  assert.match(layout, /const faqHref =/);
  assert.match(layout, /id="nav-faq">FAQ<\/a>/);
  assert.match(layout, /href=\{faqHref\} class="footer__link">Frequently asked questions<\/a>/);
  assert.match(page, /id="faq-preview"/);
  assert.match(page, /id="all-faqs-link"/);
});

test("built FAQ and homepage render real FAQ content and working relative links", async () => {
  const faq = await readFile(new URL("../dist/faq/index.html", import.meta.url), "utf8");
  const home = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.equal([...faq.matchAll(/<details\b/g)].length, 68);
  assert.match(faq, /id="faq-why-preaudit"/);
  assert.match(faq, /id="faq-why-canonical-plus"/);
  assert.match(faq, /id="faq-guarantee"/);
  assert.match(faq, /id="faq-critical-finding"/);
  assert.match(faq, /id="faq-soc2-types"/);
  assert.match(faq, /id="faq-evidence-automation"/);
  for (const anchor of ["faq-first-sprint","faq-new-product-scope","faq-cloud-provider-compliance","faq-soc2-bridge-letter","faq-machine-identities","faq-penetration-testing","faq-control-operating-period","faq-sensitive-evidence","faq-auditor-coordination","faq-pilot-engagement"]) {
    assert.ok(faq.includes(`id="${anchor}"`), `missing built FAQ deep link ${anchor}`);
  }
  assert.match(home, /Read all 68 FAQs/);
  assert.match(faq, /<summary\b/);
  assert.match(faq, /href="\/quote\/"/);
  assert.match(home, /href="\/faq\/#faq-why-preaudit"/);
  assert.match(home, /href="\/faq\/"/);
});

test("FAQ progressive enhancements preserve static answers and strict script boundaries", async () => {
  const [faq, faqJs, built] = await Promise.all([
    readFile(new URL("../src/pages/faq.astro", import.meta.url), "utf8"),
    readFile(new URL("../public/faq.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/faq/index.html", import.meta.url), "utf8"),
  ]);
  assert.match(faq, /id="faq-search-tools"[^>]*hidden/);
  assert.match(faq, /id="faq-search-input"/);
  assert.match(faq, /id="faq-search-status" role="status" aria-live="polite"/);
  assert.match(faq, /<script type="module" src=\{faqScriptHref\}><\/script>/);
  assert.match(faqJs, /addEventListener\('hashchange', openHashTarget\)/);
  assert.match(faqJs, /target\.open = true/);
  assert.match(faqJs, /status\.textContent = query/);
  assert.doesNotMatch(faqJs, /\.innerHTML\s*=|\beval\s*\(|new Function\s*\(/);
  assert.match(built, /\/faq\.js\?v=20261025-search/);
  assert.equal([...built.matchAll(/<details\b/g)].length, 68);
});
