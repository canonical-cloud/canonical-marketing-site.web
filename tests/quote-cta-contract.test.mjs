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
