#!/usr/bin/env node
// Read-only public HTTP response-header preflight. Never requests credentials,
// follows redirects, dumps response bodies, or logs cookies / arbitrary headers.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const ORIGIN = "https://canonical.plus";
export const PATHS = Object.freeze(["/", "/faq/", "/quote/", "/site.js", "/faq.js"]);

const rule = JSON.parse(
  readFileSync(new URL("../infra/cloudflare/canonical-plus-security-headers.rule.json", import.meta.url), "utf8"),
);
const expected = Object.fromEntries(
  Object.entries(rule.action_parameters.headers).map(([name, item]) => [name.toLowerCase(), item.value]),
);

export function checkResponseHeaders(path, response, expectedUrl) {
  const findings = [];
  if (response.status !== 200) findings.push("HTTP status " + response.status + " (expected 200)");
  if (response.url && response.url !== expectedUrl) findings.push("unexpected redirect or origin change");
  for (const [name, wanted] of Object.entries(expected)) {
    const actual = response.headers.get(name);
    if (actual === null) {
      findings.push(name + ": missing");
    } else if (name === "strict-transport-security") {
      const match = actual.match(/(?:^|;)\s*max-age\s*=\s*(\d+)(?:;|$)/i);
      if (!match || !Number.isSafeInteger(Number(match[1])) || Number(match[1]) < 1) {
        findings.push(name + ": invalid max-age");
      }
    } else if (actual !== wanted) {
      findings.push(name + ": differs from reviewed edge policy");
    }
  }
  return { path, status: response.status, findings };
}

export async function auditLiveHeaders({ fetchImpl = fetch, paths = PATHS } = {}) {
  const results = [];
  for (const path of paths) {
    if (!PATHS.includes(path)) throw new Error("unexpected diagnostic path");
    const url = new URL(path, ORIGIN).href;
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(12000),
      });
      results.push(checkResponseHeaders(path, response, url));
      if (response.body && typeof response.body.cancel === "function") {
        await response.body.cancel().catch(() => {});
      }
    } catch {
      // Do not expose request details, environment values, tokens, or response bodies.
      results.push({ path, status: "network-error", findings: ["HTTPS/TLS request failed"] });
    }
  }
  return { ok: results.every((result) => result.findings.length === 0), results };
}

export function summarizeAudit(audit) {
  return audit.results.map((result) =>
    "[live-headers] " + (result.findings.length ? "FAIL" : "PASS") + " " +
    result.path + " (HTTP " + result.status + ")" +
    (result.findings.length ? ": " + result.findings.join("; ") : ": reviewed edge headers present")
  ).join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const audit = await auditLiveHeaders();
  process.stdout.write(summarizeAudit(audit) + "\n");
  if (!audit.ok) process.exitCode = 1;
}
