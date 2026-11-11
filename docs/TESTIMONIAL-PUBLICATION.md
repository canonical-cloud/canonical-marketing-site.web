# Proposed customer testimonials: publication checklist

This is a **draft implementation**, not a claim that any listed organization
is a customer, partner, recommender, or endorser of Canonical Plus.

The site owner supplied eight names (in display order) on 2026-11-10:
ChannelMeter, Vultr, Trinity Labs, Interos.ai, Luma Health,
Benefactor.cc, Polka, and Bose Audio. The exact entities behind
“Trinity Labs” and “Polka” need disambiguation before publication.

The homepage includes a responsive 4-column testimonial grid
(2 columns on tablets, 1 on phones). It renders **nothing** until all
eight records in `src/data/testimonial-candidates.json` are approved.

For each record, retain outside the public repo:
1. Evidence of the actual Canonical Plus relationship (including relevant
   legal entity and scope). Enter an opaque internal reference ID in
   `relationshipEvidence`, not a contract or confidential record.
2. Written permission to publicly identify the organization and to use its
   exact quotation/attribution; enter the reference ID in
   `publicationConsent`.
3. An authentic, exact quote and authorized speaker/attribution. Do not
   invent a statement, paraphrase into a first-person quote, or imply an audit
   outcome or independent certification.
4. Brand usage approval if official logos are added later. Current cards use
   company names as text; no third-party logo assets are included.
5. Independent claims/legal review per
   `canonical-cloud/canonical-docs/docs/claims-register.md`.


## Company logo sourcing (research only)

The following logo URL candidates were located on each company's **own**
website on 2026-11-10. They are metadata in the proposed record, **not**
bundled or rendered, and do not establish permission or endorsement.
`logoSourceUrl` is not a client-side image URL.

- ChannelMeter — channelmeter.com (the terms page expressly requires prior
  written consent before using the company's marks).
- Vultr — vultr.com.
- interos.ai — interos.ai.
- Luma Health — lumahealth.io.
- Benefactor.cc — benefactor.cc.
- Bose — bose.com (Bose is a registered trademark).

**Trinity Labs** and **Polka** need confirmed legal/entity domains before
selecting logos; there are multiple plausible companies using those names.

When consent has been retained, obtain the correct current SVG/PNG/WebP logo
and inspect/sanitize the asset (especially SVG), store it locally at
`public/brand/testimonials/<company-id>.<ext>` and set its
`logoAssetPath` field to that root-relative path. Also record the consent
reference in `logoUseConsent`. Never hotlink third-party logo images:
external image fetches create availability/privacy dependencies and may
violate the deployed site's restrictive CSP. Test all eight images across
desktop, tablet, mobile, and light/medium/dark themes.

Only after review, set `approvedForPublication: true` **for all eight**.
Partial approval intentionally leaves the whole section unpublished.
Run `npm test` and `npm run test:browser` at exact head, then verify the
deployed origin after a reviewed merge; CI alone does not prove deployment.


## Release-integrity checks

A new mandatory prebuild verification step, `node scripts/testimonial-publication.mjs`, validates the exact eight-company order and rejects partial approval, invalid logo paths, missing consent/evidence fields, nonexistent/symlinked assets, malformed PNG/WebP headers, oversized images, and potentially active/external-content SVG features. The validator never downloads remote content, and an unpublished section causes **zero** asset loads.

A conservative SVG check is not equivalent to a complete XML sanitizer. Prefer a visually reviewed PNG/WebP export where possible; manually review every approved logo, its license, its exact domain, and the effective CSP. Brand-source URLs alone are not permissions.

The browser test uses eight **synthetic fixtures created in the test browser only**, checking four desktop columns, two tablet columns, one mobile column, image loads, and light/medium/dark themes. Synthetic text and logo fixtures do not ship with the site. This test must not be described as evidence of public customer endorsements.

To reproduce the release gate:
- `npm run build` (runs the validator before Astro)
- `node --test tests/testimonial-publication.test.mjs`
- `npm run test:browser`

All eight client-specific publication records remain OFF and empty until reviewed evidence and written permission are retained.
