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

The production Pages deployment validates `PUBLIC_SUPABASE_URL` before publishing. A
missing or non-`https://*.supabase.co` value blocks production deployment instead of
silently publishing non-functional forms.
