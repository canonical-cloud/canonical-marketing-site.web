import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const quote = await readFile(new URL('../src/pages/quote.astro', import.meta.url), 'utf8');
const contact = await readFile(new URL('../src/pages/contact.astro', import.meta.url), 'utf8');
const intake = await readFile(new URL('../public/intake-form.js', import.meta.url), 'utf8');
const site = await readFile(new URL('../public/site.js', import.meta.url), 'utf8');
const brand = await readFile(new URL('../public/brand-overrides.css', import.meta.url), 'utf8');

test('quote and contact pages use one public intake endpoint contract', () => {
  for (const page of [quote, contact]) {
    assert.match(page, /PUBLIC_CANONICAL_INTAKE_URL/);
    assert.match(page, /data-intake-endpoint=\{intakeEndpoint\}/);
    assert.match(page, /src=\{intakeScriptHref\}/);
    assert.match(page, /name="contact_name"/);
    assert.match(page, /name="contact_email"/);
    assert.match(page, /name="organization_name"/);
    assert.match(page, /name="company_website"/);
  }
  assert.match(quote, /data-intake-kind="quote"/);
  assert.match(contact, /data-intake-kind="contact"/);
});

test('intake client bounds payloads and does not expose privileged credentials', () => {
  assert.match(intake, /slice\(0, max\)/);
  assert.match(intake, /contact_email: clean\(values\.contact_email, 254\)/);
  assert.match(intake, /notes: clean\(values\.notes, 2000\)/);
  assert.match(intake, /credentials: 'omit'/);
  assert.match(intake, /Idempotency-Key/);
  assert.match(intake, /company_website/);
  assert.doesNotMatch(intake, /service_role|SUPABASE_SERVICE|DATABASE_URL|SMTP_PASSWORD|RESEND_API_KEY|Authorization:\s*Bearer/i);
});

test('hello address is prominent in shared site chrome and direct page actions', () => {
  assert.match(site, /hello@canonical\.plus/);
  assert.match(site, /footer__prominent-contact/);
  assert.match(brand, /\.footer__prominent-contact/);
  assert.match(quote, /href="mailto:hello@canonical\.plus"/);
  assert.match(contact, /href="mailto:hello@canonical\.plus"/);
  assert.match(contact, /Send to hello@canonical\.plus/);
});

test('sitewide boundary copy leads with the service rather than the disclaimer', () => {
  assert.match(site, /Canonical supports readiness and pre-audit preparation/);
  assert.match(site, /Scope frameworks, close control and evidence gaps, plan remediation/);
  assert.match(site, /qualified independent evaluators make formal assurance and certification decisions/);
});

test('commercial flexibility is stated without promising automatic discounts', () => {
  assert.match(quote, /Milestone payment plans are available/);
  assert.match(quote, /may qualify for bundled-scope discounts/);
  assert.match(quote, /Discounts are written into the proposal rather than implied by the estimator/);
  assert.match(contact, /Payment plans and bundled-scope discounts can be discussed/);
});
