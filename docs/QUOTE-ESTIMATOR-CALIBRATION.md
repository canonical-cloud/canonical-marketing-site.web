# Canonical Plus — Quote estimator calibration and release gates

Status: draft model review, 2026-11-11. **Not a price list, approved proposal, signed SOW or statistical confidence interval.**

## Commercial authority

The numeric estimator is the pinned `canonical-cloud/canonical-interfaces` **public-quote-estimator/v2**. Its marketing and Supabase copies must pass structural parity tests; never adjust monetary factors in just one consumer. Its published applicability range is **$5,000–$25,000 USD** for qualifying one-time readiness projects. The three separate published monthly service packages are not computed by this estimator. Sector is descriptive and has zero automatic surcharge.

Current model (before round-to-$500 and bounds):

```text
raw_midpoint =
  (speed.baseUsd
   + sum(unique selected framework amountUsd)
   + delivery_depth.amountUsd
   + environment_complexity.amountUsd
   + employee_band.amountUsd
   + sector.amountUsd /* currently zero */)
  × company_stage.multiplier

low  = round_to_500(raw_midpoint × 0.90)
high = round_to_500(raw_midpoint × 1.12)
```

The 0.90–1.12 factors are **heuristic planning bounds, not empirical percentiles**. The model may not represent actual effort, assessor fees, legal advice, penetration testing, tooling subscriptions, internal personnel time, or guaranteed delivery outcomes. The floor and ceiling must **not** be represented as a binding price floor/ceiling for unusually broad programs.

## Qualification versus pricing

`quote-scope.json`, `public/quote-scope.js`, and `supabase/functions/public-intake/quote-scope.mjs` contain seven identical scoping dimensions:

- cloud accounts / production environments;
- in-scope production-system count;
- existing control-evidence maturity;
- control owners / stakeholders;
- production-data classification;
- regulatory / jurisdiction footprint;
- anticipated technical-remediation load.

These fields carry **no new monetary coefficient**. They qualify whether to show an instant range at all. Custom scoping is required for FedRAMP/federal authorization, >10 cloud accounts, 6+ production systems, >20 control owners, multiple regulated entities/jurisdictions, unknown assumptions, operational programs with mostly missing evidence, regulated-data engineering remediation, intensive hands-on remediation, large+complex enterprise, or modeled work falling outside either end of v2's range. Neither the lower floor nor upper ceiling may be applied as a silent price-clipping operation. Refusing an instant price is intentional; it does not mean the engagement cannot be purchased.

The browser hides the numeric result and disables quote submission. The authoritative Edge Function independently enforces the same decision and returns HTTP 422 `custom_scope_required` **before storage and email**. Invalid scope keys/values fail with HTTP 400. The pure v2 pricing helper retains support for historical unscoped calculations in internal parity fixtures, but the **public Edge HTTP endpoint requires all seven scope fields** before any credential read, persistence, or email. Legacy HTTP clients missing `selection.scope` now receive HTTP 422 `custom_scope_required`; malformed supplied scopes receive HTTP 400. This is an intentional security-first cutover, not backward-compatible quote delivery.

## Rollout order

1. Commercial/security/legal review of scope thresholds, monthly-vs-project wording, boundary exclusions, and companion draft marketing PR #146 plus canonical-docs PR #60.
2. Confirm the Supabase Edge Function can be deployed to the actual owned canonical-cloud project; deploy **server first** and execute signed-off admission tests against it. Verify standard v2 inputs **with complete seven-field `selection.scope`**, and prove legacy missing-scope inputs return 422 before I/O, malformed scopes return 400, and custom/federal/floor- or ceiling-clipped inputs return 422. Check that no email or inquiry row is created for any rejection.
3. Publish the public client only after an end-to-end server response with the new `selection.scope` object succeeds. The old live page does not send `selection.scope`, so a server-first deployment temporarily rejects its quote-email requests with 422 until the frontend is deployed. Announce and bound the maintenance window; never deploy a newer client against an unverified older function (it can reject the unknown scope field with 400). If production intake cannot be configured, keep explicit email-unavailable fallback and DO NOT describe the feature as operational.
4. Verify the live /quote/ page and every selected input transition; check that all custom cases hide ranges and cannot submit. Verify email to a controlled mailbox, safe summary escaping, and one-time/mensual language. If the endpoint is absent, retain the explicit email-delivery-unavailable fallback.
5. Require exact-head `npm test`, `npm run build`, `npm run test:browser`, and release policy checks. CI does not imply deployment, real provider delivery, or sound pricing calibration.

## Actual price-accuracy improvement requires data

Before introducing new numeric factors or claiming improved prediction error, collect permissioned, de-identified project data and get business approval for a **versioned v3 pricing contract**. Track at least:

- Proposed vs signed SOW price, realized billable and non-billable hours, actual loaded delivery costs, gross margin, and scope changes.
- Framework combinations, boundary size, integrations/cloud accounts, control owners, evidence maturity, data residency, remediation complexity, expected/actual delivery window, and outsourced assessor/tooling exclusions.
- Industry only where a measured effect remains after controlling for those variables; avoid proxy industry taxes.
- Forecast error on held-out engagements (MAE, median APE, bias by stage/sector/framework), actual interval coverage, and severe underquote rate.
- Whether the realized scope was materially different from initial selections; label such cases, don't fit erroneous coefficients to them.

Only promote coefficients after independent commercial review, shared JSON Schema/TypeSpec/fixture versioning, browser/server exact parity, regression and edge-case testing, and a monitored release. No historical actuals or approved cost model were available as inputs to PR #152.

## Reconciliation with sibling PR #153

The seven-question model integrates #153's production-system count and data-exposure classification and retains #152's cloud-account footprint, control-owner count, jurisdiction footprint, and remediation load. The existing evidence-maturity question subsumes #153's readiness-baseline field. Request-scoping models are **not interchangeable**: #152 sends `selection.scope` and #153 sends top-level `scopeContext`. These must **never be deployed as mismatched browser/server revisions**, and only one implementation should be selected for a release. #152 also fences asynchronous quote-response updates when a user edits selections while email delivery is in flight.

The final allowed limits still require independent review; numerical thresholds here are proposed qualification gates, not validated commercial underwriting or an empirical price model.

## Exact release prerequisites (no silent bypass)

- The candidate code is intentionally **not an authorization to merge or deploy**. Independent technical and pricing review, privacy/legal clearance and a verified owned Supabase project remain required. The merged website and deployed Edge version are distinct deployment states.
- At every release, verify the PR head SHA and GitHub Actions **executed nonzero** steps for Node tests, Chromium E2E and deployable-container browser security. A green workflow label without jobs is insufficient.
- Confirm the Supabase Edge function is bound to the canonical.plus origin and has correct email-provider, storage and rate-limit configuration without exposing credentials to client code.
- Exercise a non-production real provider test only with an approved controlled mailbox; check requester delivery and copy to hello@canonical.plus. Automated tests use fixtures and never send emails.
- Do not close the production release gate until the live origin, authoritative Edge version, and supported seven-field request contract are verified together.

## Source-pinned deployment mechanism (disabled by default)

The manual-only `.github/workflows/public-intake-release.yml` is **not enabled for production by this PR**. A repository administrator must first (a) configure and verify required independent reviewers on `supabase-staging` and `supabase-production` environments, (b) provision per-environment `SUPABASE_PROJECT_REF` and scoped `SUPABASE_ACCESS_TOKEN` secrets, and (c) explicitly set the repository variable `CANONICAL_SUPABASE_DEPLOY_APPROVED=true`. Without that variable, no deploy job can start. The workflow also requires a main-branch run, an exact approved full 40-character commit SHA that matches the checked-out source, and a target-specific confirmation string. Do not enable before commercial/legal approval or a staging smoke test.

During the controlled release, `scripts/stamp-public-intake-release.mjs` puts the reviewed main SHA in the deployed Edge bundle. `HEAD /functions/v1/public-intake` is side-effect-free and returns `x-canonical-intake-revision` plus `x-canonical-intake-contract: quote-seven-scope-v1`. `scripts/verify-intake-release.mjs` accepts only an exact source match and verified CORS on HEAD/OPTIONS; it never issues POST or triggers storage/email. The checked-in revision is `unreleased`, so an unstamped deployment cannot falsely pass this check.

**A correct HEAD stamp verifies bundle provenance and protocol readiness, not successful email delivery**. After staging, use only a separately approved controlled inbox to validate storage, rate limits, and actual requester/CC email. Verify the live page revision and server contract together after the Pages release. Keep the public fallback when production environment variables are unavailable.
