# Live HTTPS recovery: canonical.plus (Cloudflare to GitHub Pages)

**Incident observed 2026-10-16:** requesting https://canonical.plus/ returns **Cloudflare HTTP 526 — Invalid SSL certificate**. The Astro article and GitHub Pages deployment had passed CI. Build success is not end-to-end HTTPS verification. Cloudflare 526 indicates failed origin-certificate validation in Full (strict) mode.

## Diagnose without changing production

1. In **Cloudflare → DNS → Records**, inspect the apex (@) and www records, their target and proxied/DNS-only flags. Also inspect origin rules, Workers, Load Balancers, tunnel routes, and SNI overrides. Cloudflare-proxied A results are Cloudflare edge IPs, not evidence of the origin.
2. In **canonical-cloud/canonical-marketing-site.web → Settings → Pages**, confirm Custom domain is **canonical.plus** and the custom-domain DNS check and certificate status are healthy. The site deploys with a custom GitHub Actions workflow: GitHub says repository CNAME files are **ignored** for this mode, so adding a CNAME file is not a fix.
3. If GitHub Pages is the correct origin, validate apex DNS target against **185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153** (and the equivalent GitHub Pages AAAA addresses where configured). Review www CNAME to canonical-cloud.github.io. Remove only confirmed conflicting records. Check CAA records for letsencrypt.org.
4. The workflow **public-https-health** logs DNS and tests the public URL, then tests those four GitHub Pages endpoints directly using curl --resolve with TLS SNI **canonical.plus**. Direct tests retain normal certificate validation; insecure TLS is never used. A direct certificate mismatch strongly suggests the Pages custom-domain cert is absent or wrong.
5. If GitHub has no valid certificate, temporarily use **DNS only** for the affected Pages records, and check GitHub's Pages custom-domain certificate provisioning. Re-saving the GitHub custom domain can trigger reprovisioning. Wait for GitHub's HTTPS status to be valid, then verify direct-origin HTTPS before restoring Cloudflare's proxy.
6. Keep Cloudflare **Full (strict)**. Verify homepage, Insights, blog 1, old article redirect and www from multiple networks. If origin checks pass but public HTTP 526 persists, inspect Cloudflare's actual origin target, custom origin SNI, and Workers. Capture Ray ID and time for diagnosis.

## Security and release boundaries

- Never set **Flexible** to bypass a broken origin certificate; do not leave **Full** without certificate validation as the long-term solution.
- GitHub Pages is managed hosting; there is no self-managed origin on which to install a Cloudflare Origin CA certificate.
- Do not change nameservers, DNS, TLS modes or HSTS before verifying the targeted site and rollback path.
- Success from Pages Actions proves artifact deployment, not Cloudflare reachability.
- The health workflow runs after successful Pages deployment, daily, on manual request, and on PRs changing the monitor. It fails for non-200 or unexpected content, and surfaces the 525/526 diagnosis.

## Sources

- Cloudflare HTTP 526: https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-526/
- GitHub Pages custom domain: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
- GitHub Pages certificate provisioning: https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https
- GitHub Pages custom-workflow CNAME: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages
