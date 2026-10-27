import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const cloudflare = JSON.parse(
  await readFile(new URL("../infra/cloudflare/canonical-plus-security-headers.rule.json", import.meta.url), "utf8"),
);
const nginx = await readFile(new URL("../nginx.conf", import.meta.url), "utf8");

test("Cloudflare rule is scoped, not an entire phase-ruleset replacement", () => {
  assert.equal(cloudflare.ref, "canonical_plus_public_security_headers");
  assert.equal(cloudflare.action, "rewrite");
  assert.equal(cloudflare.expression, '(http.host eq "canonical.plus")');
  for (const forbidden of ["kind", "phase", "rules", "id"]) {
    assert.equal(cloudflare[forbidden], undefined);
  }
  assert.equal(cloudflare.action_parameters?.headers?.["X-Content-Type-Options"]?.value, "nosniff");
});

test("every edge header uses a static set operation without injection or wildcards", () => {
  const headers = cloudflare.action_parameters.headers;
  assert.deepEqual(
    Object.keys(headers).sort(),
    [
      "Content-Security-Policy",
      "Cross-Origin-Opener-Policy",
      "Permissions-Policy",
      "Referrer-Policy",
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "X-Frame-Options",
    ].sort(),
  );
  for (const [name, setting] of Object.entries(headers)) {
    assert.match(name, /^[A-Za-z-]+$/);
    assert.equal(setting.operation, "set", name);
    assert.equal(typeof setting.value, "string", name);
    assert.ok(setting.value.length > 0, name);
    assert.doesNotMatch(setting.value, /[\r\n]/, name);
    assert.equal(setting.expression, undefined, name);
  }
  assert.equal(headers["Strict-Transport-Security"].value, "max-age=86400");
  assert.doesNotMatch(headers["Strict-Transport-Security"].value, /includeSubDomains|preload/);
});

test("Cloudflare and nginx enforce identical headers except edge-only HSTS", () => {
  for (const [name, setting] of Object.entries(cloudflare.action_parameters.headers)) {
    if (name === "Strict-Transport-Security") continue;
    const expression = "^\\s*add_header\\s+" + name + '\\s+"([^"]+)"\\s+always;\\s*$';
    const match = nginx.match(new RegExp(expression, "mi"));
    assert.ok(match, name + " must be present with always in nginx");
    assert.equal(setting.value, match[1], "security policy drift for " + name);
  }
  const csp = cloudflare.action_parameters.headers["Content-Security-Policy"].value;
  assert.match(csp, /script-src 'self'/);
  assert.doesNotMatch(csp, /script-src[^;]*(?:'unsafe-inline'|'unsafe-eval'|\*)/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
});
