# Public quote scoping and price-accuracy release notes (2026-11-11)

## Pricing authority and what changed

The public project quote uses the pinned `canonical-cloud/canonical-interfaces` public-quote-estimator **v2** configuration. This change deliberately leaves USD prices, factors, rounding, bounds, standard IDs, and recurring service tiers unchanged. A scope-qualification sidecar adds three *qualitative* questions:

- Number of in-scope production systems: one, 2–5, 6+, unknown.
- Current control/evidence maturity: established, partial, new, unknown.
- Data classification: standard business, personal/sensitive, regulated in production, unknown.

The public range remains a **one-time planning estimate**, not a recurring monthly subscription, full independent audit, certification, FedRAMP authorization, penetration test, or fee cap.

## Fail-closed conditions

A routine public dollar range is suppressed, and email quote submission is disabled, when:

1. FedRAMP readiness is selected (not an inexpensive add-on to normal SOC 2 work).
2. The unbounded price would exceed the pinned v2 midpoint or total-estimate ceilings; clipping is not a defensible quote.
3. There are 6+ production systems, or system scope / maturity / data classification is unknown.
4. A new program requires managed operational readiness or hands-on remediation rather than advisory-only.
5. Regulated production-data engineering remediation is requested.

These are **routing/eligibility rules**, not extra numeric surcharges. The browser and Supabase intake must both enforce them. On the server, requests lacking a valid scope context fail closed. A custom-scope request must not be stored or emailed as an accepted price. Ordinary SOC 2/ISO scopes keep the previously governed numeric model.

## Readiness to deploy

- Run Node unit/static tests and actual browser transitions on the *exact PR head*; require non-zero executed steps. Check that normal default remains USD 10,000–12,500, FedRAMP/6+/unknown/oversized become custom, and returning to normal restores a range.
- Have commercial owner validate the boundary, qualification thresholds, and real labor-rate/cost assumptions. The new questions improve *classification*, not empirical price calibration.
- Have privacy/security reviewers validate no sensitive data is collected beyond the bounded categorical values and no client-supplied price is ever trusted.
- Deploy the Supabase `public-intake` Edge Function and website together with a short fail-closed cutover. **Old clients without `scopeContext` will receive an invalid-quote response once the updated Edge Function is live.** Do not claim production intake is operational merely because frontend code merged.
- Confirm production server revision / secrets / email provider, then live browser + actual email receipt to requester and CC to `hello@canonical.plus`. Keep fallbacks visible if Supabase is not configured.
- Confirm final signed SOW exclusions, readiness vs independent assurance boundaries, and current 2026 FedRAMP rules.

## Next pricing-model increment

To truly improve dollar accuracy, create a reviewed **v3** price authority from actual anonymized engagement costs: billable specialist hours, hourly loaded delivery rates, evidence-source count, cloud/account count, applications, team/owner count, framework control overlap, policy maturity, expected remediation backlog, geographic/privacy obligations, travel, tools, subcontractor costs, discount policy, and target gross margin. Calibrate using closed/won/lost SOWs and reviewed actuals, evaluate error by segment, and publish only approved ranges. Do not silently invent client price points or modify the version-pinned v2 fixture.
