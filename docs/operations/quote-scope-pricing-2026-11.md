# Public quote scoping and price-accuracy release notes (2026-11-11)

## Pricing authority and what changed

The public project quote uses the pinned `canonical-cloud/canonical-interfaces` public-quote-estimator **v2** configuration. This change deliberately leaves USD prices, factors, rounding, bounds, standard IDs, and recurring service tiers unchanged. A scope-qualification sidecar adds seven *qualitative* questions:

- Number of in-scope production systems: one, 2–5, 6+, unknown.
- Current control/evidence maturity: established, partial, new, unknown.
- Data classification: standard business, personal/sensitive, regulated in production, unknown.
- Cloud-account/environment inventory: 1–2, 3–10, 11+, unknown.
- Control owners/stakeholders: 1–5, 6–20, 21+, unknown.
- Entity/jurisdiction footprint: single, multiple regions under one entity, multiple regulated entities, unknown.
- Technical remediation effort: light, moderate, substantial, unknown.

The public range remains a **one-time planning estimate**, not a recurring monthly subscription, full independent audit, certification, FedRAMP authorization, penetration test, or fee cap.

## Fail-closed conditions

A routine public dollar range is suppressed, and email quote submission is disabled, when:

1. FedRAMP readiness is selected (not an inexpensive add-on to normal SOC 2 work).
2. The unbounded price would exceed the pinned v2 midpoint or total-estimate ceilings; clipping is not a defensible quote.
3. There are 6+ production systems, or system scope / maturity / data classification is unknown.
4. A new program requires managed operational readiness or hands-on remediation rather than advisory-only.
5. Regulated production-data engineering remediation is requested.
6. There are 11+ cloud accounts or 21+ control owners, or their inventories are unknown.
7. The work spans multiple regulated entities/jurisdictions, or that boundary is unknown.
8. Hands-on engineering requires substantial remediation, or the effort is unknown.
9. A 3-week program starts without existing control maturity, or a large enterprise has a complex 1,001+ employee boundary.

These are **routing/eligibility rules**, not extra numeric surcharges. The browser and Supabase intake must both enforce them. On the server, requests lacking a valid scope context fail closed. A custom-scope request must not be stored or emailed as an accepted price. Ordinary SOC 2/ISO scopes keep the previously governed numeric model.

## Readiness to deploy

- Run Node unit/static tests and actual browser transitions on the *exact PR head*; require non-zero executed steps. Check that normal default remains USD 10,000–12,500, FedRAMP/6+/11+ accounts/21+ owners/multi-regulated/heavy remediation/unknown/oversized become custom, and returning to normal restores a range.
- Have commercial owner validate the boundary, qualification thresholds, and real labor-rate/cost assumptions. The new questions improve *classification*, not empirical price calibration.
- Have privacy/security reviewers validate no sensitive data is collected beyond the bounded categorical values and no client-supplied price is ever trusted.
- Deploy the Supabase `public-intake` Edge Function and website together with a short fail-closed cutover. **Old clients without `scopeContext` will receive an invalid-quote response once the updated Edge Function is live.** Do not claim production intake is operational merely because frontend code merged.
- Confirm production server revision / secrets / email provider, then live browser + actual email receipt to requester and CC to `hello@canonical.plus`. Keep fallbacks visible if Supabase is not configured.
- Confirm final signed SOW exclusions, readiness vs independent assurance boundaries, and current 2026 FedRAMP rules.

## Next pricing-model increment

To truly improve dollar accuracy, create a reviewed **v3** price authority from actual anonymized engagement costs: billable specialist hours, hourly loaded delivery rates, evidence-source count, cloud/account count, applications, team/owner count, framework control overlap, policy maturity, expected remediation backlog, geographic/privacy obligations, travel, tools, subcontractor costs, discount policy, and target gross margin. Calibrate using closed/won/lost SOWs and reviewed actuals, evaluate error by segment, and publish only approved ranges. Do not silently invent client price points or modify the version-pinned v2 fixture.

## Consolidation from draft #152

This PR intentionally incorporates #152's cloud-account, control-owner, regulatory footprint, and technical-remediation qualification criteria, and maps its evidence-maturity question to the existing `readinessBaseline` control. The original #153 production-system and data-classification questions remain. This avoids an overlapping second public quote-scope schema and keeps strict server/client validation aligned. Draft #152 should be reviewed for unique improvements before closure, not merged independently over this branch.

Seven qualitative fields are routing metadata, **not billable prices**. The $5,000–$25,000 published applicability window remains a heuristic v2 window for qualifying engagements; it must never be described as a maximum fee or a measured confidence interval. No labor-cost actuals or independently approved v3 coefficients have been provided.
