import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const component = await readFile(
  new URL("../src/components/PreInterestForm.astro", import.meta.url),
  "utf8",
);
const landing = await readFile(
  new URL("../src/pages/interest/index.astro", import.meta.url),
  "utf8",
);
const individual = await readFile(
  new URL("../src/pages/interest/individual.astro", import.meta.url),
  "utf8",
);
const organization = await readFile(
  new URL("../src/pages/interest/organization.astro", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

test("landing page routes each party to the exact standard host", () => {
  assert.match(
    landing,
    /https:\/\/user\.canonical\.plus\/interest\/individual\//,
  );
  assert.match(
    landing,
    /https:\/\/org\.canonical\.plus\/interest\/organization\//,
  );
  assert.doesNotMatch(landing, /auth\.canonical\.plus|admin\.canonical\.plus/);
});

test("forms submit only to their same-role customer-web host", () => {
  assert.match(
    component,
    /https:\/\/user\.canonical\.plus\/api\/pre-interest/,
  );
  assert.match(
    component,
    /https:\/\/org\.canonical\.plus\/api\/pre-interest/,
  );
  assert.match(component, /method="post"/);
  assert.doesNotMatch(component, /api-admin\.canonical\.plus/);
  assert.doesNotMatch(component, /auth\.canonical\.plus/);
});

test("form fields match the privacy-minimized contract", () => {
  for (const name of [
    "partyType",
    "consentRevision",
    "email",
    "organizationName",
    "interestAreas",
    "referralCode",
    "contactConsent",
  ]) {
    assert.match(component, new RegExp(`name="${name}"`));
  }

  for (const forbidden of [
    "password",
    "accessToken",
    "identityDocument",
    "quoteAnswers",
    "sourceHost",
    "requestId",
    "consentedAt",
  ]) {
    assert.doesNotMatch(component, new RegExp(`name="${forbidden}"`));
  }
  assert.doesNotMatch(component, /<textarea\b/i);
});

test("consent is required and explicitly separate from account, marketing, and quote consent", () => {
  assert.match(component, /name="contactConsent"[\s\S]*required/);
  assert.match(component, /value="pre-interest-v1"/);
  assert.match(component, /separate from[\s\S]*account creation,[\s\S]*marketing subscriptions,[\s\S]*quote request/);
});

test("forms work without JavaScript and retain accessible labels", () => {
  assert.doesNotMatch(component, /<script\b/i);
  assert.match(component, /<label for=\{emailId\}>Work email<\/label>/);
  assert.match(component, /<fieldset class="form-field">/);
  assert.match(component, /<legend>What are you interested in\?<\/legend>/);
  assert.match(component, /type="submit"/);
});

test("party pages cannot silently change the selected party type", () => {
  assert.match(individual, /<PreInterestForm partyType="individual" \/>/);
  assert.match(organization, /<PreInterestForm partyType="organization" \/>/);
  assert.match(individual, /does not create an account or quote/);
  assert.match(organization, /kept separate from any later quote/);
});

test("the existing test command discovers the new contract test", () => {
  assert.match(packageJson.scripts.test, /tests\/pre-interest-contract\.test\.mjs/);
});
