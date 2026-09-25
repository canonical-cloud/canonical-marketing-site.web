import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../src/pages/quote.astro", import.meta.url), "utf8");
const layout = await readFile(new URL("../src/layouts/BaseLayout.astro", import.meta.url), "utf8");
const catalog = JSON.parse(
  await readFile(new URL("../src/data/service-tiers.json", import.meta.url), "utf8"),
);

test("public quote reuses the published three-tier catalog", () => {
  assert.equal(catalog.tiers.length, 3);
  assert.deepEqual(
    catalog.tiers.map((tier) => tier.id),
    ["foundation-readiness", "managed-readiness", "assurance-engineering"],
  );
  assert.match(page, /catalog\.tiers\.map/);
  assert.match(page, /name="preferredTier"/);
});

test("public quote uses the ores-forms edge and opto-sync enhancement", () => {
  assert.match(page, /action="\/form-edge\/submit\/canonical-quote"/);
  assert.match(page, /data-opto-sync-form="canonical\.quote"/);
  assert.match(page, /src="\/form-edge\/client\.js"/);
  assert.match(page, /method="post"/);
});

test("public quote captures bounded commercial and readiness scope", () => {
  for (const field of [
    "contactName",
    "email",
    "organizationName",
    "website",
    "employeeCount",
    "preferredTier",
    "frameworks",
    "currentStage",
    "targetDate",
    "infrastructure",
    "notes",
  ]) {
    assert.match(page, new RegExp(`name="${field}"`));
  }
  assert.match(page, /Readiness, not the audit/);
});

test("marketing separates public quote from authenticated app entry", () => {
  assert.match(layout, /const quoteHref = `\$\{baseNoSlash\}\/quote\/`;/);
  assert.match(layout, /const signInHref = 'https:\/\/app\.canonical\.plus\/quote';/);
  assert.match(layout, /id="nav-sign-in"/);
  assert.match(layout, /id="nav-quote"/);
});
