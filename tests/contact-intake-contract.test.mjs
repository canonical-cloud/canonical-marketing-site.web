import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const page = await readFile(new URL("../src/pages/contact.astro", import.meta.url), "utf8");
const runtime = await readFile(new URL("../public/contact-intake.js", import.meta.url), "utf8");
const layout = await readFile(new URL("../src/layouts/BaseLayout.astro", import.meta.url), "utf8");

test("contact page makes hello@canonical.plus prominent and offers a structured form", () => {
  assert.match(page, /hello@canonical.plus/);
  assert.match(page, /data-contact-intake-form/);
  assert.match(page, /name="displayName"/);
  assert.match(page, /name="email"/);
  assert.match(page, /name="organizationName"/);
  assert.match(page, /name="topic"/);
  assert.match(page, /name="message"/);
  assert.match(page, /minlength="20"/);
  assert.match(page, /payment plan, or package discount/i);
  assert.match(layout, /Contact hello@canonical.plus/);
});

test("contact form submits only to the reviewed intake edge and exposes no backend secret", () => {
  assert.match(runtime, /const INTAKE_ENDPOINT = 'https://forms.canonical.plus/v1/intake'/);
  assert.match(runtime, /await fetch(INTAKE_ENDPOINT/);
  assert.match(runtime, /credentials: 'omit'/);
  assert.match(runtime, /AbortController/);
  assert.doesNotMatch(runtime, /SUPABASE_SERVICE|service_role|RESEND_API_KEY|DATABASE_URL|CANONICAL_INTERNAL/i);
});

test("contact page keeps formal assurance roles accurately separated", () => {
  assert.match(page, /independent reviewer/i);
  assert.match(page, /qualified independent provider remains responsible/i);
  assert.doesNotMatch(page, /guaranteed audit|guaranteed certification|we issue SOC 2|we certify/i);
});
