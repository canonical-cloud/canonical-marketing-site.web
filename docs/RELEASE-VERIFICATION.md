# Public marketing release verification

Status: source implementation; not proof of live content or authenticated-app health.

A successful Pages upload does not prove the custom hostname serves the intended
revision. `postbuild` now writes `dist/release.json` with a deterministic SHA-256
for each of `/`, `/readiness/`, `/frameworks/`, and `/compare/`.
The manifest binds those bytes to this repository and the clean checkout's exact
Git revision. Dirty checkouts or exported/container builds without Git are
explicitly unversioned (`sourceRevision: null`), never assigned a fabricated SHA.

## Read-only external check

From the reviewed source checkout, run:

```sh
npm run verify:release -- <expected-40-character-commit-sha>
```

Select the expected revision from the actual successful publication workflow's
checked-out source, not merely latest main. The checker permits only the fixed
HTTPS `canonical.plus` origin and the fixed manifest/page paths. It performs five
bounded GET requests, with no credentials, redirects, arbitrary URLs, or writes.
A source revision mismatch, missing/duplicate page, stale HTML, HTML fallback,
non-200 response, wrong content type, body overflow, or network failure fails.
Logs contain only stable codes, public source revision, and counts, not bodies.
The body-read deadline is eight seconds per request; the total is at most five
sequential requests. There is no polling or implicit retry loop.

Run hermetic tests with `node --test tests/release-manifest.test.mjs`.
All existing suites remain in `npm test`. The live command is intentionally not
a required PR gate and is not automatically run by builds or deployment events;
this preserves DEN-1349's separation between source correctness and external
production incidents. No new scheduled workflow is introduced.

## Operator interpretation

- PASS means the fetched four HTML documents match the manifest at the selected
  revision. It is not a signature, independent attestation, full asset integrity
  proof, authenticated quote test, certificate audit, or vulnerability scan.
- A stale cached manifest with the wrong revision fails rather than being
  accepted as a deployment. A correct marker with old HTML also fails.
- CDN HTML transformations will change byte hashes. Preserve publication bytes
  on these routes or review the transformation; do not weaken the check to make
  a mismatching release appear healthy.
- Node's standard HTTPS certificate verification remains enabled. The command
  does not diagnose DNS/TLS ownership or modify Cloudflare cache settings.
- The authenticated app and `account.canonical.plus` redirect require separate
  auth, owner-isolation, no-store, fragment, and rollback checks.

## Evidence observed during this continuation

The GitHub Pages build/deploy jobs in run `33272256804` report success for source
`c5c4cc6e8868bb8c302f4eb34a7dfa163d7026e9`. The public web fetch returned a cached
older audit-led page. The execution container cannot resolve public hosts, so
this discrepancy is not enough to prove current production is stale. Verify
with a fresh exact-revision check after this instrumentation is published.

Tracking: DEN-1349. No live deployment is performed by this change.
