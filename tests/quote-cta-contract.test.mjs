import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const layout = await readFile(
  new URL("../src/layouts/BaseLayout.astro", import.meta.url),
  "utf8",
);

test("marketing navigation makes the public no-login quote the primary CTA", () => {
  assert.match(layout, /const publicQuoteHref = `\$\{baseNoSlash\}\/quote\/`/);
  assert.match(layout, /id="nav-quote"[^>]*>Get a quote<\/a>/);
  assert.match(layout, /href=\{publicQuoteHref\}[^>]*id="nav-quote"/);
  assert.doesNotMatch(layout, /id="nav-quote"[^>]*data-application-link/);
});

test("sign in stays absent until authentication is supported", () => {
  assert.doesNotMatch(layout, /const applicationHref\s*=/);
  assert.doesNotMatch(layout, /id="nav-sign-in"/);
  assert.doesNotMatch(layout, /data-application-link="sign-in"/);
  assert.doesNotMatch(layout, />Sign in<\/a>/);
});

test("footer exposes the public quote path and carries no auth-token material", () => {
  assert.match(layout, /href=\{publicQuoteHref\}[^>]*>Build a quote<\/a>/);
  assert.doesNotMatch(layout, /app\.canonical\.plus\/[^'"\s]*\?[^'"\s]*(?:token|jwt|access_token)=/i);
});

const home = await readFile(new URL("../src/pages/index.astro", import.meta.url), "utf8");
const quote = await readFile(new URL("../src/pages/quote.astro", import.meta.url), "utf8");

test("homepage and public quote hero have direct Calendly intro booking links", () => {
  const calendly = "https://calendly.com/hello-canonical/30min";
  assert.ok(home.includes(`const introHref = '${calendly}';`));
  assert.ok(quote.includes(`const introHref = '${calendly}';`));
  assert.match(home, /href=\{introHref\}[^>]*id="hero-cta-book-intro"[^>]*target="_blank" rel="noopener noreferrer"/);
  assert.match(quote, /href=\{introHref\}[^>]*id="quote-book-intro"[^>]*target="_blank" rel="noopener noreferrer"/);
  assert.ok(home.includes("Book an intro"));
  assert.ok(quote.includes("Book an intro"));
});

test("no sign-in or signup CTA is advertised by the marketing layout or quote page", () => {
  for (const page of [layout, home, quote]) {
    assert.doesNotMatch(page, /<(?:a|button)\b[^>]*>\s*(?:Sign in|Log in|Sign up|Create an account)/i);
  }
  assert.doesNotMatch(quote, /Sign in for account quote|appQuoteUrl/);
});
