# Public quote boundary

`/quote/` is a public, no-login planning estimator. It is intentionally separate from the authenticated quote workflow at `https://app.canonical.plus/u/quote`.

## Security and privacy invariants

- The public estimator calculates entirely in browser memory.
- Estimator interactions must not call `fetch`, XHR, WebSocket, EventSource, `sendBeacon`, or another submission transport.
- Estimator state must not be written to localStorage, sessionStorage, IndexedDB, cookies, or URL query/fragment state.
- Selecting **Sign in** starts the separate authenticated quote workflow. The local estimator state is not automatically transferred.
- The public page must never contain an internal service credential, database credential, service-role credential, or privileged API token.
- The public estimator is a non-binding planning range. A reviewed statement of work controls final scope and price.
- Changing any estimator input after local completion invalidates the completed snapshot.
- Invalid or malformed estimator configuration fails closed: completion is disabled and no numeric estimate is presented.

## Authenticated boundary

The customer quote API remains account-scoped. The marketing site does not weaken or bypass its authentication, owner isolation, CSRF/origin checks, idempotency rules, or server-side validation. Anonymous persistence is not part of the public estimator contract.

## Regression coverage

The default static suite verifies configuration integrity, privacy/no-storage guarantees, bounded pricing, truthful authenticated-handoff copy, accessibility semantics, fail-closed behavior, and secret absence.

The browser suite verifies that the public page:

1. loads without authentication;
2. recalculates the 9/5/3-week estimate interactively;
3. refuses completion with no selected framework;
4. completes locally with a selected framework;
5. invalidates a completed snapshot after any input change;
6. emits no network request during estimator interaction; and
7. remains usable without horizontal overflow at mobile width.

Any future feature that persists an anonymous quote is a separate server/API contract and must add abuse controls, explicit data-retention semantics, tenant/owner rules, and corresponding contract tests rather than silently reusing the authenticated quote API.
