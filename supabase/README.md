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
