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

Only after review, set `approvedForPublication: true` **for all eight**.
Partial approval intentionally leaves the whole section unpublished.
Run `npm test` and `npm run test:browser` at exact head, then verify the
deployed origin after a reviewed merge; CI alone does not prove deployment.
