# Cloudflare response headers for canonical.plus

**Status:** configuration prepared in Git; **not applied to Cloudflare**. Track the production fix in [issue #139](https://github.com/canonical-cloud/canonical-marketing-site.web/issues/139). The current deployed static site is served through Cloudflare → GitHub Pages. Edits to `nginx.conf`, the static HTML CSP meta tag, or a `public/_headers` file do **not** add HTTP response headers at this hosting boundary.

## Read-only evidence

The scheduled `live browser smoke` job tested the public HTTPS response and failed with missing `X-Content-Type-Options: nosniff`. Its actual deployed-origin check is distinct from the local container test and the GitHub Pages HTTPS health check. A rerun on October 27, 2026 reproduced the missing header. Preserve the live Chromium test; do not downgrade it to a markup check.

## Approval-gated GitHub workflow (not executed)

A new [manual workflow](../../.github/workflows/cloudflare-security-headers.yml)
uses the scoped [rule file](../../infra/cloudflare/canonical-plus-security-headers.rule.json)
and [single-rule API script](../../scripts/cloudflare-header-rule.mjs).
It is **not** enabled as an automatic production deployment.

Before using it, the authorized infrastructure owner must configure the
`cloudflare-production` GitHub environment with **required reviewers**, a
restricted deployment branch, and secrets `CANONICAL_CF_ZONE_ID` and
`CANONICAL_CF_API_TOKEN` (scoped to the canonical.plus zone with only needed
Transform Rules access). No token or zone identifier is committed. Review the
existing rules and confirm DNS proxy/TLS state first.

Run the workflow in `inspect` mode to read the existing zone phase and
report whether a single scoped rule would be added, patched, or unchanged.
The script fails closed when a competing response-header rule is detected,
an existing managed rule has a different matcher, or the phase entry point
does not exist. To apply, a human must separately select `apply` and enter
`APPLY_CANONICAL_PLUS_HEADERS`; the protected environment must approve.
The script uses only Cloudflare single-rule POST or PATCH, never a full-ruleset
PUT. It reads the rule back and then runs a live HTTP header audit.

**Deployment acceptance is still the scheduled/manual `live browser smoke`
with executed Chromium steps against the actual `https://canonical.plus/`
response.** Never mark issue #139 fixed based only on this script, a GitHub
green build, a Cloudflare API acknowledgment, or local container headers.

## Deploy the scoped response-header rule

The **rule fragment** in [`infra/cloudflare/canonical-plus-security-headers.rule.json`](../../infra/cloudflare/canonical-plus-security-headers.rule.json) is ready to add to the zone's **existing** `http_response_headers_transform` ruleset. Its match expression is `(http.host eq "canonical.plus")` and its action is `rewrite`. It sets CSP, `nosniff`, frame denial, referrer policy, opener policy, permissions policy, and a **short, host-only** HSTS lifetime of one day.

An authorized Cloudflare zone administrator should:

1. Verify that `canonical.plus` is still served through the **proxied** Cloudflare DNS record, that the public TLS certificate and the GitHub Pages origin are healthy, and that all site routes and static assets work.
2. In **Cloudflare → Rules → Transform Rules → Modify Response Headers**, inspect existing rules, order, scopes, and any other policies that might override these settings. If a compatible canonical.plus rule already exists, edit that rule instead of adding competing rules.
3. Add or update a rule matching `http.host eq "canonical.plus"`. Use **Set static**, not Add static, for each key/value in the committed JSON fragment. Keep the exact, separately scoped `canonical.plus` host matcher; do not apply this to the entire `canonical-cloud` zone or sibling applications.
4. **Preserve every unrelated rule** in the zone ruleset. The JSON file represents a **single rule**, not a complete phase ruleset. Do not `PUT` it as the entire `rules` list: the Cloudflare Rulesets API full-ruleset update can replace existing rules. Check any later rules that could overwrite the headers.
5. Validate the live public HTTPS response on `/`, `/faq/`, `/quote/` and representative JavaScript/CSS responses; confirm the FAQ search and quote widget still function, and verify inline executable scripts remain blocked.
6. Rerun the **live browser smoke** job against `https://canonical.plus/`. Only close issue #139 when **that job** succeeds with actual executed steps and public response headers. Document the zone change, rule identifier, run URL, and rollback method.

For API-driven deployment, list the existing zone rulesets first, find its `http_response_headers_transform` zone-phase ruleset, and **merge this one new rule** into the existing rules array. The documented Cloudflare API requires a zone-scoped ruleset with `rewrite` action and `action_parameters.headers`. A suitable API token must have zone Transform Rules edit and account Rulesets read privileges. Never commit the token, zone ID, or a downloaded private ruleset.

### Response headers and HSTS rollout

The seven static header values in the JSON are intentionally aligned with `nginx.conf` except `Strict-Transport-Security`, which must be set by the HTTPS terminator. Initial HSTS is `max-age=86400` **without** `includeSubDomains` or `preload`. Increase the duration only after validating every relevant HTTPS endpoint and establishing a tested rollback plan. The fallback HTML meta CSP cannot express `frame-ancestors` and does not protect non-HTML responses.

### Rollback

Use Cloudflare rule version/history or disable **only** the new `canonical_plus_public_security_headers` rule if there is a breakage. Do not globally change TLS mode, DNS routing, or other zones. Re-run the public smoke tests after rollback and record the reason. Header rollback will not immediately clear any HSTS policy a browser has already cached.

## References

- [Cloudflare Response Header Transform Rules via API](https://developers.cloudflare.com/rules/transform/response-header-modification/create-api/)
- [Cloudflare response-header limitations and ordering](https://developers.cloudflare.com/rules/transform/response-header-modification/)
- [Cloudflare response transform rules with Terraform](https://developers.cloudflare.com/terraform/additional-configurations/transform-rules/)
- [Existing domain/TLS recovery runbook](./live-https-cloudflare.md)
