import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const edge = await readFile(new URL("supabase/functions/public-intake/index.ts", root), "utf8");
const migration = await readFile(new URL("supabase/migrations/20261001203000_public_intake_hardening.sql", root), "utf8");
const integrityMigration = await readFile(new URL("supabase/migrations/20261002123000_public_intake_integrity.sql", root), "utf8");
const pagesWorkflow = await readFile(new URL(".github/workflows/pages.yml", root), "utf8");
const contactPage = await readFile(new URL("src/pages/contact.astro", root), "utf8");
const contactRuntime = await readFile(new URL("public/contact-form.js", root), "utf8");
const localEstimator = JSON.parse(await readFile(new URL("src/data/quote-estimator.json", root), "utf8"));
const serverEstimatorModule = await import(new URL("../supabase/functions/public-intake/quote-estimator.v2.mjs", import.meta.url));
const quoteEngineModule = await import(new URL("../supabase/functions/public-intake/quote-engine.mjs", import.meta.url));
const quoteEngineSource = await readFile(new URL("supabase/functions/public-intake/quote-engine.mjs", root), "utf8");

test("server quote authority projection stays semantically identical to the browser projection", () => {
  assert.deepEqual(serverEstimatorModule.default, localEstimator);
});

test("server quote engine recomputes canonical values from bounded selection ids", () => {
  assert.match(edge, /import \{ computeQuote \} from '\.\/quote-engine\.mjs'/);
  assert.match(quoteEngineSource, /quoteConfig\.speeds\.find/);
  assert.match(quoteEngineSource, /itemById\(quoteConfig\.companyStages/);
  assert.match(quoteEngineSource, /additive \* stage\.multiplier/);
  assert.match(quoteEngineSource, /invalid_quote_selection/);
  assert.doesNotMatch(edge, /payload\.range/);
  assert.doesNotMatch(edge, /scope\.deliverySpeed/);

  const selection = {
    speedWeeks: 5,
    standardIds: ["soc2", "iso27001"],
    deliveryDepthId: "managed",
    complexityId: "growing",
    companyStageId: "business",
    employeeBandId: "11-50",
    sectorId: "technology",
    lowerUsd: 1,
    upperUsd: 2,
  };
  const quote = quoteEngineModule.computeQuote(selection);
  assert.deepEqual(quote.range, { lowerUsd: 10000, upperUsd: 12500, currency: "USD" });
  assert.equal(
    quote.summary,
    "5 weeks · SOC 2 + ISO 27001 · Managed readiness · Growing environment · Business · 11–50 employees · Technology / SaaS",
  );
});

test("server quote engine rejects tampered or ambiguous selections", () => {
  const valid = {
    speedWeeks: 5,
    standardIds: ["soc2"],
    deliveryDepthId: "managed",
    complexityId: "growing",
    companyStageId: "business",
    employeeBandId: "11-50",
    sectorId: "technology",
  };
  assert.throws(
    () => quoteEngineModule.computeQuote({ ...valid, standardIds: ["soc2", "soc2"] }),
    /invalid_quote_selection/,
  );
  assert.throws(
    () => quoteEngineModule.computeQuote({ ...valid, companyStageId: "invented-enterprise" }),
    /invalid_quote_selection/,
  );
  assert.throws(
    () => quoteEngineModule.computeQuote({ ...valid, speedWeeks: 1 }),
    /invalid_quote_selection/,
  );
  assert.throws(
    () => quoteEngineModule.computeQuote({ ...valid, speedWeeks: "5" }),
    /invalid_quote_selection/,
  );
  assert.throws(
    () => quoteEngineModule.computeQuote({ ...valid, standardIds: ["soc2", 7] }),
    /invalid_quote_selection/,
  );
  assert.throws(
    () => quoteEngineModule.computeQuote({ ...valid, lowerUsd: 1 }),
    /invalid_quote_selection/,
  );
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
  assert.match(edge, /cleanMultiline/);
  assert.doesNotMatch(edge, /access-control-allow-headers': 'authorization, apikey/);
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


test("pending deliveries use a bounded retry lease and storage calls time out", () => {
  assert.match(edge, /updated_at/);
  assert.match(edge, /15 \* 60 \* 1000/);
  assert.match(edge, /AbortSignal\.timeout/);
  assert.match(edge, /email_failed/);
  assert.match(integrityMigration, /add column if not exists updated_at/);
  assert.match(integrityMigration, /bucket_start < clock_timestamp\(\) - interval '2 days'/);
});

test("database constrains kind/source/payload integrity", () => {
  assert.match(integrityMigration, /public_inquiries_source_kind_chk/);
  assert.match(integrityMigration, /kind = 'quote' and source = 'canonical\.plus\/quote'/);
  assert.match(integrityMigration, /kind = 'contact' and source = 'canonical\.plus\/contact'/);
  assert.match(integrityMigration, /provider_message_id_length_chk/);
});

test("production Pages deployment fails closed on missing or invalid Supabase origin", () => {
  assert.match(pagesWorkflow, /Validate production public-intake configuration/);
  assert.match(pagesWorkflow, /https:\/\/\*\.supabase\.co/);
  assert.match(pagesWorkflow, /PUBLIC_SUPABASE_URL must be configured/);
});
