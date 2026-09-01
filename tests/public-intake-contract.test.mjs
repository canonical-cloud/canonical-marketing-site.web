import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const chooser = await readFile(
  new URL("../src/pages/interest/index.astro", import.meta.url),
  "utf8",
);
const individual = await readFile(
  new URL("../src/pages/pre-interest.astro", import.meta.url),
  "utf8",
);
const organization = await readFile(
  new URL("../src/pages/submit-application.astro", import.meta.url),
  "utf8",
);
const receipt = await readFile(
  new URL("../src/pages/registration-received.astro", import.meta.url),
  "utf8",
);
const pages = [individual, organization];

test("marketing chooser routes to the two standard hosts without accepting a form", () => {
  assert.match(chooser, /data-public-intake-chooser="standard-hosts"/);
  assert.match(chooser, /https:\/\/user\.canonical\.plus\/pre-interest/);
  assert.match(chooser, /https:\/\/org\.canonical\.plus\/submit-application/);
  assert.match(chooser, /https:\/\/user\.canonical\.plus\/u\/quote/);
  assert.doesNotMatch(chooser, /<form/);
  assert.doesNotMatch(chooser, /\/forms\/pre-interest/);
  assert.doesNotMatch(chooser, /https:\/\/(?:auth|admin|api-admin)\.canonical\.plus/);
});

test("public intake pages use the standard user and organization host contract", () => {
  assert.match(individual, /data-required-host="user\.canonical\.plus"/);
  assert.match(organization, /data-required-host="org\.canonical\.plus"/);
  assert.match(individual, /https:\/\/org\.canonical\.plus\/submit-application/);
  assert.match(organization, /https:\/\/user\.canonical\.plus\/pre-interest/);
  for (const page of [...pages, receipt, chooser]) {
    assert.match(page, /https:\/\/user\.canonical\.plus\/u\/quote/);
    assert.doesNotMatch(page, /https:\/\/app\.canonical\.plus\/u\/readiness/);
  }
});

test("forms preserve normal no-JavaScript same-origin submission", () => {
  for (const page of pages) {
    assert.match(page, /action=\{formAction\}/);
    assert.match(page, /const formAction = '\/forms\/pre-interest';/);
    assert.match(page, /method="post"/);
    assert.match(page, /<noscript>/);
    assert.doesNotMatch(page, /<script/);
  }
});

test("the BFF, not the browser, derives security-sensitive envelope fields", () => {
  for (const page of pages) {
    assert.doesNotMatch(page, /name="requestId"/);
    assert.doesNotMatch(page, /name="consentedAt"/);
    assert.doesNotMatch(page, /name="sourceHost"/);
    assert.doesNotMatch(page, /name="partyType"/);
    assert.match(page, /opaque\s+idempotency/i);
  }
});

test("registration and marketing permission remain separate explicit choices", () => {
  for (const page of pages) {
    assert.match(page, /name="registrationConsent"[\s\S]*required/);
    assert.match(page, /name="marketingPermission" value="yes" required/);
    assert.match(page, /name="marketingPermission" value="no" required/);
    assert.match(page, /name="consentRevision" value="pre-interest-v1"/);
    assert.match(
      page,
      /name="marketingConsentCopyRevision" value="marketing-v1"/,
    );
  }
});

test("bounded contact and interest fields match the contract", () => {
  assert.match(individual, /name="email"[\s\S]*maxlength="320"[\s\S]*required/);
  assert.match(organization, /name="organizationName"[\s\S]*maxlength="200"[\s\S]*required/);
  for (const page of pages) {
    assert.match(page, /name="displayName"[\s\S]*maxlength="120"/);
    assert.match(page, /name="websiteUrl"[\s\S]*maxlength="2048"/);
    assert.match(page, /name="interestAreas"/);
    assert.match(page, /\['readiness_assessment', 'Readiness assessment'\]/);
    assert.match(page, /\['cmmc', 'CMMC'\]/);
    assert.doesNotMatch(page, /name="notes"/);
    assert.doesNotMatch(page, /name="message"/);
  }
});

test("accepted receipt is enumeration resistant and never implies quote creation", () => {
  assert.match(receipt, /data-public-intake-receipt="accepted"/);
  assert.match(receipt, /same confirmation for new, repeated, and previously known/i);
  assert.match(receipt, /does not reveal whether an address already existed/i);
  assert.match(receipt, /No account, role, entitlement, quote, audit, certification, or authorization was created/);
  assert.match(receipt, /https:\/\/user\.canonical\.plus\/u\/quote/);
});

test("pages never embed credentials, tokens, or database connection material", () => {
  const combined = [...pages, receipt, chooser].join("\n").toLowerCase();
  assert.doesNotMatch(combined, /database_url|postgres(?:ql)?:\/\/|supabase_service|authorization:\s*bearer/i);
  assert.doesNotMatch(combined, /access_token|refresh_token|client_secret|api[_-]?key/i);
});
