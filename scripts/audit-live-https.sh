#!/usr/bin/env bash
# Diagnostic-only: observes public DNS, Cloudflare and GitHub Pages HTTPS.
# Does not change DNS, certificates, Cloudflare settings or origin servers.
set -euo pipefail

host="canonical.plus"
path="/blogs/1/"
public_url="https://${host}${path}"
scratch="$(mktemp -d)"
status=""
curl_exit=0

echo "::group::Public DNS (from GitHub-hosted runner)"
for record in A AAAA CAA NS; do
  echo "${host} ${record}:"
  dig +time=3 +tries=1 +short "${host}" "${record}" || true
done
for record in A AAAA CNAME; do
  echo "www.${host} ${record}:"
  dig +time=3 +tries=1 +short "www.${host}" "${record}" || true
done
echo "::endgroup::"

echo "::group::Live end-to-end HTTPS via Cloudflare"
status="$(curl --silent --show-error --location --max-redirs 4 --max-time 25 \
  --output "${scratch}/public.html" --dump-header "${scratch}/public.headers" \
  --write-out '%{http_code}' "${public_url}")" || curl_exit=$?
echo "GET ${public_url}: HTTP ${status:-000}, curl exit ${curl_exit}"
grep -iE '^(server:|cf-ray:|location:|content-type:)' "${scratch}/public.headers" || true
if [[ "${status}" =~ ^52(5|6)$ ]]; then
  echo "::error title=Cloudflare origin TLS failure::HTTP ${status}: check GitHub Pages origin certificate and Cloudflare DNS / TLS mode."
fi
echo "::endgroup::"

echo "::group::GitHub Pages direct-origin TLS checks (SNI canonical.plus; no --insecure)"
# GitHub Pages' documented IPv4 origin addresses. --resolve bypasses
# Cloudflare without changing the request's hostname or TLS verification.
origin_valid=0
for ip in 185.199.108.153 185.199.109.153 185.199.110.153 185.199.111.153; do
  origin_exit=0
  origin_status="$(curl --silent --show-error --location --max-redirs 3 --max-time 15 \
    --resolve "${host}:443:${ip}" --output "${scratch}/origin.html" \
    --write-out '%{http_code}' "${public_url}" 2>"${scratch}/origin.err")" || origin_exit=$?
  echo "GitHub Pages ${ip}: HTTP ${origin_status:-000}, curl exit ${origin_exit}"
  if [[ "${origin_exit}" != 0 ]]; then
    sed -n '1,3p' "${scratch}/origin.err"
  fi
  if [[ "${origin_exit}" == 0 && "${origin_status}" == 200 ]]; then
    origin_valid=1
  fi
done
echo "At least one GitHub Pages direct HTTPS origin succeeded: ${origin_valid}"
echo "::endgroup::"

echo "::group::GitHub Pages origin certificate identity and validity window"
# Read public certificate metadata, even if the expired certificate fails curl.
# A failed OpenSSL probe cannot itself mask the principal HTTP 526 failure.
timeout 12 openssl s_client -connect 185.199.108.153:443 -servername "${host}" </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName || true
echo "::endgroup::"


if [[ "${curl_exit}" != 0 || "${status}" != 200 ]]; then
  echo "::error::Public HTTPS smoke check failed; deployment success alone does not mean Cloudflare origin TLS is valid."
  exit 1
fi

# Avoid mistaking Cloudflare's themed error page for a successfully deployed blog.
if ! grep -q 'How C++26 becomes an' "${scratch}/public.html"; then
  echo "::error::Public HTTPS returned 200 but expected C++26 article content is missing."
  exit 1
fi
echo "PASS: ${public_url} is reachable with a trusted certificate and expected content."
