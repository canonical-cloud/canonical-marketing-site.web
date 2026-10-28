import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import {
  ORIGIN, PATHS, checkResponseHeaders, auditLiveHeaders, summarizeAudit,
} from "../scripts/audit-live-response-headers.mjs";

const config = JSON.parse(
  await readFile(new URL("../infra/cloudflare/canonical-plus-security-headers.rule.json", import.meta.url), "utf8"),
);
const completeHeaders = Object.fromEntries(
  Object.entries(config.action_parameters.headers).map(([name, value]) => [name, value.value]),
);

function response(path, { status = 200, headers = completeHeaders, url = new URL(path, ORIGIN).href } = {}) {
  return { status, headers: new Headers(headers), url };
}

test("preflight checks the production homepage, FAQ, quote, and two static assets", () => {
  assert.equal(ORIGIN, "https://canonical.plus");
  assert.deepEqual(PATHS, ["/", "/faq/", "/quote/", "/site.js", "/faq.js"]);
  for (const path of PATHS) {
    assert.deepEqual(checkResponseHeaders(path, response(path), new URL(path, ORIGIN).href).findings, []);
  }
});

test("preflight reports every missing or incorrect header without leaking response values", () => {
  const headers = new Headers(completeHeaders);
  headers.delete("X-Content-Type-Options");
  headers.delete("X-Frame-Options");
  headers.set("Content-Security-Policy", "default-src *");
  const findings = checkResponseHeaders("/", response("/", { headers }), ORIGIN + "/").findings;
  assert.ok(findings.some((line) => line.includes("x-content-type-options: missing")));
  assert.ok(findings.some((line) => line.includes("x-frame-options: missing")));
  assert.ok(findings.some((line) => line.includes("content-security-policy: differs")));
  assert.equal(findings.length, 3);
  const text = summarizeAudit({ results: [{ path: "/", status: 200, findings }] });
  assert.doesNotMatch(text, /default-src \*/);
  assert.doesNotMatch(text, /cookie|authorization/i);
});

test("preflight refuses redirects and bad HTTP statuses even with otherwise complete headers", () => {
  const redirected = checkResponseHeaders("/faq/", response("/faq/", {
    status: 302,
    url: "https://other.example/faq/",
  }), ORIGIN + "/faq/");
  assert.equal(redirected.findings.length, 2);
  assert.match(redirected.findings.join(" "), /origin change/);
});

test("preflight insists on nonzero HSTS without enforcing subdomain preload", () => {
  const headers = new Headers(completeHeaders);
  headers.set("Strict-Transport-Security", "max-age=0");
  assert.ok(checkResponseHeaders("/", response("/", { headers }), ORIGIN + "/").findings.some(
    (line) => line.includes("invalid max-age"),
  ));
  headers.set("Strict-Transport-Security", "max-age=31536000");
  assert.deepEqual(checkResponseHeaders("/", response("/", { headers }), ORIGIN + "/").findings, []);
});

test("preflight checks every route, even when one HTTPS request fails", async () => {
  const called = [];
  const fetchImpl = async (url, options) => {
    assert.equal(options.redirect, "manual");
    assert.equal(options.method, "GET");
    called.push(new URL(url).pathname);
    if (url.endsWith("/faq/")) throw new Error("sensitive fake network exception");
    return response(new URL(url).pathname);
  };
  const result = await auditLiveHeaders({ fetchImpl });
  assert.deepEqual(called, PATHS);
  assert.equal(result.ok, false);
  assert.equal(result.results.length, PATHS.length);
  assert.equal(result.results.filter((entry) => entry.status === "network-error").length, 1);
  assert.doesNotMatch(summarizeAudit(result), /sensitive fake network exception/);
});
