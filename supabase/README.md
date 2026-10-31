# Canonical Cloud Supabase public intake

Target Supabase organization: **ORESoftware**  
Target project / database name: **canonical-cloud**

This repository contains the migration and Edge Function required by
`canonical.plus/quote/` and `canonical.plus/contact/`.

## Deploy

1. Create or select the `canonical-cloud` project in the ORESoftware Supabase organization.
2. Link this repository's `supabase/` directory to that project.
3. Apply all migrations in `supabase/migrations/` in filename order. This includes
   public inquiry storage, idempotency/rate limits, and the later integrity/lease hardening.
4. Set Edge Function secrets:
   - `RESEND_API_KEY`
   - `PUBLIC_INTAKE_RATE_LIMIT_SALT` — at least 24 random characters; rotate only with awareness that rate-limit buckets will reset
   - `CANONICAL_FROM_EMAIL=Canonical Plus <hello@canonical.plus>`
5. Deploy `supabase/functions/public-intake`.
6. Set the marketing-site build variable:
   - `PUBLIC_SUPABASE_URL`

The browser receives only the public Supabase URL. `public-intake` is explicitly
configured with `verify_jwt = false` because it is a public marketing endpoint; the
application handler enforces origin, bounded inputs, idempotency, honeypot handling, and
server-side quotas. No Supabase API key is required in the browser.

Hosted Supabase injects the new secret-key environment used for privileged REST calls.
The implementation prefers `SUPABASE_SECRET_KEYS` / `SUPABASE_SECRET_KEY` and retains
`SUPABASE_SERVICE_ROLE_KEY` only as a migration fallback. Mail-provider and quota-salt
credentials remain server-side.

## Protected Edge Function release and evidence (draft workflow)

The reviewed `public-intake` handler supports a side-effect-free **HEAD**
request that reports these public response headers:
`x-canonical-intake-revision` (the exact reviewed main commit) and
`x-canonical-intake-contract: fedramp-custom-scope-v1`. An ordinary
source checkout reports `unreleased`; only the controlled deployment
workflow stamps the reviewed SHA into the deployed bundle.

The [manual GitHub release workflow](../.github/workflows/public-intake-release.yml)
is intended to run **only after an approved commit has merged to main**.
Before enabling production use, an authorized administrator must configure
**both** `supabase-staging` and `supabase-production` GitHub environments
with required human reviewers and deployment-branch restrictions to `main`.
Each environment must contain the project-specific
`SUPABASE_PROJECT_REF` and an appropriately scoped `SUPABASE_ACCESS_TOKEN`.
Never share production credentials with staging, PR workflows, or website
artifacts. A GitHub environment that exists without protection rules is
**not** adequate approval.

1. Validate the migrations, quota RPC, and privileged application secrets
   in the **chosen** project using a separately authorized process.
2. Independently review the code and record the exact merged main commit.
   Trigger `approved public-intake Edge Function release` on `main`,
   choose `staging` or `production`, provide that 40-character commit
   as `approved_sha`, and enter the corresponding literal confirmation:
   `DEPLOY_CANONICAL_INTAKE_STAGING` or
   `DEPLOY_CANONICAL_INTAKE_PRODUCTION`.
3. The workflow checks out the latest `main` and **refuses deployment**
   if its SHA differs from the approval. It executes server quote/security
   and read-only release tests, stamps the SHA in the Edge Function bundle,
   then deploys only `public-intake` using the Supabase CLI.
4. The workflow immediately probes the deployed endpoint using **HEAD and
   OPTIONS only**. It rejects a missing/mismatched revision, unexpected
   contract marker, redirect, bad CORS origin, or missing `no-store`.
   These requests do not store records, consume rate-limit quota, or
   send emails. CI executes the exact tests, independently of the
   deployment receipt.
5. In an **authorized staging project with a controlled email sink**,
   explicitly test the HTTP `422 custom_scope_required` response for a
   fully shaped FedRAMP quote, both alone and mixed with SOC 2, followed by
   a normal SOC 2 quote. The latter is a **write/email test** and MUST NOT
   run in production or against uncontrolled mail recipients. Confirm the
   rejected quote created no record or email; normal valid flow must be
   checked with controlled database/mail evidence. The pure computation
   regression covers normal quote ranges during ordinary PR CI.
6. Only after staging and production approvals, deploy to production and
   document the workflow run, exact source revision, project identity (in
   private release records), deploy receipt, read-only HEAD/OPTIONS result,
   live response/header checks, and rollback instructions. Never treat
   a green source build or successful deployment command as proof of
   actual customer-email delivery.

For an independent read-only check, from an authorized environment set
`SUPABASE_PROJECT_REF` and `CANONICAL_EXPECTED_RELEASE_SHA`, then run:

```sh
node scripts/verify-intake-release.mjs
```

The verifier only contacts the exact `https://<project-ref>.supabase.co`
public function URL. It carries no secrets, does not POST, and never
accepts a URL with query parameters or a substituted host. A stale
`unreleased` function fails the check.

### Rollback and exposure limits

An authorized operator can redeploy the **previous approved commit** using
the same protected release process, recording the reason and rechecking its
HEAD revision and public behavior. Restore the prior independently approved
deployment rather than silently downgrading JWT, origin, quota, or email
protection. If an old revision lacks the HEAD attestation, document that
the automated release gate cannot prove it and require a separate security
sign-off for recovery. Do not create artificial production quote requests
as a health check: older revisions might email or persist them.

The HEAD marker proves the function bundle claims the Git revision stamped
by the protected workflow. It does **not** independently prove the deployed
database migration, origin routing, mail provider configuration, or that
external auditor acceptance has occurred. No production deployment is
performed merely by merging the workflow source.

## Email behavior

- Quote submissions are emailed to the requester's work email and CC
  `hello@canonical.plus`.
- Contact submissions are emailed to `hello@canonical.plus` with the requester's
  address as Reply-To.
- Both kinds are persisted in `public.public_inquiries` with delivery status.

Supabase executes and stores the workflow. Transactional email delivery uses the
configured mail provider from the Edge Function; do not place provider secrets in the
marketing bundle.

## Neon

Neon can be used as a reporting/warehouse or disaster-recovery database, but the public
form must have one authoritative write path. Do not dual-write from the browser. If Neon
is introduced, replicate asynchronously from the server-side intake pipeline with an
idempotency key.


## Abuse and integrity controls

The public browser never supplies authoritative quote prices. It submits only option IDs;
the Edge Function recomputes the range from its pinned v2 authority projection before
persisting or emailing the result.

The intake path also requires a UUID idempotency key, uses the same key with the mail
provider, and enforces atomic server-side quotas by hashed email, hashed source IP, and a
global bucket. Rate-limit hashes use `PUBLIC_INTAKE_RATE_LIMIT_SALT`; raw IP addresses are
not stored in the quota table.

The browser `Origin` check is defense in depth, not authentication. The endpoint is still
public, so production monitoring should alert on repeated 429/5xx responses and unusual
mail-provider volume.

If an email attempt fails, the same idempotency key may retry the failed record. A pending
delivery is treated as a 15-minute processing lease; after that lease expires, it may be
retried safely with the same mail-provider idempotency key. This recovers from an Edge
Function timeout after database insertion without creating duplicate email. Successful or
currently leased submissions return the same accepted result without sending another message.

The production Pages deployment validates `PUBLIC_SUPABASE_URL`. A non-empty
value must be a `https://*.supabase.co` origin; other non-empty values block
deployment. When the variable is missing, the public website may still publish
marketing content, but contact/quote delivery is explicitly unavailable and the
site displays email fallbacks. Configure the actual Supabase project URL and deploy
the Edge Function before claiming those intake routes are operational.
