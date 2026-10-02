# Canonical Cloud Supabase public intake

Target Supabase organization: **ORESoftware**  
Target project / database name: **canonical-cloud**

This repository contains the migration and Edge Function required by
`canonical.plus/quote/` and `canonical.plus/contact/`.

## Deploy

1. Create or select the `canonical-cloud` project in the ORESoftware Supabase organization.
2. Link this repository's `supabase/` directory to that project.
3. Apply `supabase/migrations/20261001165000_public_inquiries.sql`.
4. Set Edge Function secrets:
   - `RESEND_API_KEY`
   - `PUBLIC_INTAKE_RATE_LIMIT_SALT` — at least 24 random characters; rotate only with awareness that rate-limit buckets will reset
   - `CANONICAL_FROM_EMAIL=Canonical Plus <hello@canonical.plus>`
5. Deploy `supabase/functions/public-intake`.
6. Set the marketing-site build variables:
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The browser receives only the public Supabase URL and publishable key. The service-role
key and mail-provider credential stay inside the Edge Function environment.

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

If an email attempt fails, the same idempotency key may retry the failed record. Successful
or in-flight submissions return the same accepted result without sending another message.
