import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const layout = await readFile(
  new URL("../src/layouts/BaseLayout.astro", import.meta.url),
  "utf8",
);

test("marketing navigation separates public quote and authenticated app entry", () => {
  assert.match(layout, /const quoteHref = `\$\{baseNoSlash\}\/quote\/`;/);
  assert.match(layout, /const signInHref = 'https:\/\/app\.canonical\.plus\/quote';/);
  assert.match(layout, /href=\{signInHref\}[^>]*id="nav-sign-in"[^>]*>Sign in<\/a>/);
  assert.match(layout, /href=\{quoteHref\}[^>]*id="nav-quote"[^>]*>Start readiness assessment<\/a>/);
});

test("quote links never carry bearer material", () => {
  const publicDestinations = [...layout.matchAll(/href=\{quoteHref\}/g)];
  assert.ok(publicDestinations.length >= 3, "expected public quote links in navigation and footer");
  assert.doesNotMatch(layout, /(?:quote|readiness)\?[^'"\s]*(?:token|jwt|access_token)=/i);
});
