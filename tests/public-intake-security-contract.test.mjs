import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const edge = await readFile(new URL("supabase/functions/public-intake/index.ts", root), "utf8");
const migration = await readFile(new URL("supabase/migrations/20261001203000_public_intake_hardening.sql", root), "utf8");
const contactPage = await readFile(new URL("src/pages/contact.astro", root), "utf8");
const contactRuntime = await readFile(new URL("public/contact-form.js", root), "utf8");
const localEstimator = JSON.parse(await readFile(new URL("src/data/quote-estimator.json", root), "utf8"));
const serverEstimatorModule = await import(new URL("../supabase/functions/public-intake/quote-estimator.v2.mjs", import.meta.url));

test("server quote authority projection stays semantically identical to the browser projection", () => {
  assert.deepEqual(serverEstimatorModule.default, localEstimator);
});

test("edge function recomputes quote values from bounded selection ids", () => {
  assert.match(edge, /const computeQuote =/);
  assert.match(edge, /quoteConfig\.speeds\.find/);
  assert.match(edge, /itemById\(quoteConfig\.companyStages/);
  assert.match(edge, /additive \* stage\.multiplier/);
  assert.match(edge, /invalid_quote_selection/);
  assert.doesNotMatch(edge, /payload\.range/);
  assert.doesNotMatch(edge, /scope\.deliverySpeed/);
});

test("public intake is idempotent at both database and email-provider boundaries", () => {
  assert.match(migration, /idempotency_key uuid/);
  assert.match(migration, /unique index[^\n]*public_inquiries_idempotency_key_uidx/i);
  assert.match(edge, /existingSubmission/);
  assert.match(edge, /idempotency-key': `public-intake\/\$\{idempotencyKey\}`/);
});

test("atomic quotas are private to the service role and fail closed", () => {
  assert.match(migration, /consume_public_intake_quota/);
  assert.match(migration, /security definer/i);
  assert.match(migration, /revoke all on function[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function[\s\S]*to service_role/i);
  assert.match(edge, /PUBLIC_INTAKE_RATE_LIMIT_SALT/);
  assert.match(edge, /consumeQuota/);
  assert.match(edge, /rate_limited/);
  assert.match(edge, /abuse_protection_unavailable/);
});

test("contact intake is bounded, allowlisted, and honeypot protected", () => {
  assert.match(edge, /allowedContactTopics/);
  assert.match(edge, /message\.length < 20/);
  assert.match(edge, /payload\.website/);
  assert.match(contactPage, /name="website"/);
  assert.match(contactPage, /maxlength="4000"/);
  assert.match(contactRuntime, /crypto\.randomUUID\(\)/);
  assert.match(contactRuntime, /idempotencyKey: submissionKey/);
});

test("edge function only accepts the two exact marketing sources and production origins", () => {
  assert.match(edge, /https:\/\/canonical\.plus/);
  assert.match(edge, /https:\/\/www\.canonical\.plus/);
  assert.match(edge, /canonical\.plus\/quote/);
  assert.match(edge, /canonical\.plus\/contact/);
  assert.match(edge, /source !== expectedSource/);
});

test("browser boundary is intentionally public without misusing API keys as bearer tokens", async () => {
  const quotePage = await readFile(new URL("src/pages/quote.astro", root), "utf8");
  const quoteRuntime = await readFile(new URL("public/quote-estimator.js", root), "utf8");
  const contactRuntime = await readFile(new URL("public/contact-form.js", root), "utf8");
  const config = await readFile(new URL("supabase/config.toml", root), "utf8");
  assert.match(config, /\[functions\.public-intake\][\s\S]*verify_jwt = false/);
  assert.doesNotMatch(quotePage + quoteRuntime + contactRuntime, /PUBLIC_SUPABASE_PUBLISHABLE_KEY|authorization:\s*`Bearer|apikey:\s*supabase/i);
  assert.match(edge, /SUPABASE_SECRET_KEYS/);
  assert.match(edge, /SUPABASE_SECRET_KEY/);
  assert.match(edge, /SUPABASE_SERVICE_ROLE_KEY/);
});
