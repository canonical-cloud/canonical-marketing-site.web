# canonical-marketing-site.web

[Astro](https://astro.build) marketing site for **Canonical Plus** at
[`canonical.plus`](https://canonical.plus/). The site positions Canonical Plus
as readiness-first support for software and cloud teams: framework scoping,
gap analysis, technical remediation planning, evidence operations, and
preparation for qualified independent review.

Canonical Plus does **not** present itself as the independent auditor,
certification body, 3PAO, C3PAO, QSA, regulator, accreditation body, or legal
adviser unless a current, documented, approved status later changes that
boundary.

The static build is served in the application stack by
[`canonical-web-server.rs`](https://github.com/canonical-cloud/canonical-web-server.rs).
This repository is part of the
[`canonical-monorepo`](https://github.com/canonical-cloud/canonical-monorepo)
superproject and is also usable standalone.

## Public information architecture

```text
src/
  pages/
    index.astro        # readiness-first landing page
    readiness.astro    # readiness versus independent assurance
    frameworks.astro   # framework catalog and expected artifacts
    compare.astro      # fair comparison of delivery approaches
  layouts/
    BaseLayout.astro   # metadata, navigation, footer, claims boundary
  styles/
    global.css
    marketing-pages.css
tests/
  marketing-claims-contract.test.mjs
  site-contract.test.mjs
  *-playwright.test.mjs
  *-puppeteer.test.mjs
```

The authenticated assessment entry point is exactly
`https://app.canonical.plus/u/readiness`. Marketing pages must not place tokens,
identity assertions, return destinations, or other credentials in that URL.

## Claims policy

Public copy must follow `canonical-cloud/canonical-docs/docs/claims-register.md`.

In particular:

- readiness is not an audit, attestation, certification, authorization, or
  legal conclusion;
- customer outcomes, time-to-readiness, cost savings, success rates,
  testimonials, professional qualifications, partnerships, and production
  capabilities require retained evidence before publication;
- future product direction must use conditional or future language;
- competitor comparisons must be dated, sourced from official public
  materials, and explicit about Canonical Plus limitations.

The claims contract fails CI if retired unsupported audit, CPA, guarantee,
testimonial, or comparison language returns.

## Develop

```sh
direnv allow
npm install
npm run dev
```

## Build and test

```sh
npm run build
npm test
npm run test:browser
```

## GitHub Pages

Pushes to `main` deploy the static site to
<https://canonical.plus/> through the `pages` workflow. To reproduce that
artifact locally:

```sh
npm ci
npm test
npm run build -- \
  --site https://canonical.plus \
  --base /
```
