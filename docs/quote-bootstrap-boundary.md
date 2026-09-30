# Public quote bootstrap boundary

The public `/quote/` estimator is deliberately usable without authentication and deliberately non-persistent. Its interactive completion path is admitted only after the browser runtime validates the rendered v1 estimator contract.

## States

- No JavaScript: the server-rendered planning range may be displayed, but the page cannot create a completed local quote snapshot because no completion handler exists.
- `booting`: the estimator module has started and completion is disabled while the DOM/config contract is checked.
- `ready`: all required v1 data, controls, defaults, result nodes, range metadata, and currency formatting have been validated. Only this state may enable local completion.
- `invalid`: the range is replaced with `Estimate unavailable`, the estimator is marked `aria-disabled`, all estimator controls and completion are disabled, and any completed panel is hidden.

## Security and privacy boundary

The public estimator runtime must not use `fetch`, XHR, WebSocket, EventSource, `sendBeacon`, localStorage, sessionStorage, or IndexedDB. Quote inputs and the locally completed snapshot stay in page memory only. Sign-in starts a separate authenticated workflow; no estimator state is copied into query strings, fragments, cookies, or authenticated requests.

The shared pricing/config authority lives in `canonical-cloud/canonical-interfaces` under `contracts/public-quote-estimator/v1`. This marketing repository pins an immutable reviewed revision and CI compares governed pricing semantics against that exact authority.

## Failure discipline

Do not substitute pricing defaults when the rendered contract is malformed or incompatible. Do not silently accept missing result/control nodes, duplicate IDs, non-contiguous speed indexes, invalid range controls, missing defaults, or multiple selected radio defaults. Fail closed and keep the non-binding contact/sign-in paths available.
