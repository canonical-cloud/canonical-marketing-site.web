import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagesWorkflow = await readFile(
  new URL("../.github/workflows/pages.yml", import.meta.url),
  "utf8",
);
const liveBrowserWorkflow = await readFile(
  new URL("../.github/workflows/live-browser-smoke.yml", import.meta.url),
  "utf8",
);

test("Pages deploys only a successful, tested main-branch commit", () => {
  assert.match(pagesWorkflow, /workflow_run:\s*\n\s+workflows: \[ci\]/);
  assert.match(pagesWorkflow, /types: \[completed\]/);
  assert.match(pagesWorkflow, /branches: \[main\]/);
  assert.doesNotMatch(pagesWorkflow, /\n\s+push:\s*\n/);
  assert.doesNotMatch(pagesWorkflow, /workflow_dispatch:/);
  assert.match(
    pagesWorkflow,
    /workflow_run\.conclusion == 'success'/,
  );
  assert.match(pagesWorkflow, /workflow_run\.event == 'push'/);
  assert.match(pagesWorkflow, /workflow_run\.head_branch == 'main'/);
  assert.match(
    pagesWorkflow,
    /ref: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/,
  );
});

test("Pages build and deploy checks are uniquely named and least privilege", () => {
  assert.match(pagesWorkflow, /\n  pages-build:\n/);
  assert.match(pagesWorkflow, /\n  pages-deploy:\n/);
  assert.match(pagesWorkflow, /needs: pages-build/);
  assert.match(pagesWorkflow, /pages: write/);
  assert.match(pagesWorkflow, /id-token: write/);
  assert.match(pagesWorkflow, /permissions:\s*\n\s+contents: read/);
});

test("live browser smoke is external-signal isolation, not a PR gate", () => {
  assert.match(liveBrowserWorkflow, /workflow_dispatch:/);
  assert.match(liveBrowserWorkflow, /schedule:\s*\n\s+- cron:/);
  assert.doesNotMatch(liveBrowserWorkflow, /\n\s+pull_request:/);
  assert.doesNotMatch(liveBrowserWorkflow, /\n\s+push:/);
  assert.doesNotMatch(liveBrowserWorkflow, /workflow_run:/);
  assert.match(liveBrowserWorkflow, /permissions:\s*\n\s+contents: read/);
  assert.match(liveBrowserWorkflow, /group: live-browser-smoke/);
  assert.doesNotMatch(liveBrowserWorkflow, /\$\{\{\s*secrets(?:\.|\[)/);
});

test("live browser smoke is lockfile-strict and executes the deployed policy", () => {
  assert.match(liveBrowserWorkflow, /CANONICAL_SITE_TEST_URL: https:\/\/canonical\.plus/);
  assert.match(liveBrowserWorkflow, /CANONICAL_REQUIRE_SECURITY_HEADERS: "1"/);
  assert.match(liveBrowserWorkflow, /PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1"/);
  assert.match(liveBrowserWorkflow, /PUPPETEER_SKIP_DOWNLOAD: "true"/);
  assert.match(liveBrowserWorkflow, /run: npm ci/);
  assert.doesNotMatch(liveBrowserWorkflow, /npm install|npm i\b/);
  assert.match(liveBrowserWorkflow, /playwright install chromium/);
  // Prevent apt-based browser setup from reintroducing flaky Ubuntu mirror DNS failures.
  assert.doesNotMatch(liveBrowserWorkflow, /playwright install --with-deps chromium/);
  assert.match(
    liveBrowserWorkflow,
    /tests\/container-security-playwright\.test\.mjs/,
  );
});

test("live browser diagnostics are immutable, failure-only, and short-lived", () => {
  assert.match(
    liveBrowserWorkflow,
    /CANONICAL_BROWSER_ARTIFACT_DIR: artifacts\/live-browser-smoke/,
  );
  assert.match(
    liveBrowserWorkflow,
    /if: failure\(\)\s*\n\s*uses: actions\/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9/,
  );
  assert.doesNotMatch(liveBrowserWorkflow, /if: always\(\)/);
  assert.equal(
    liveBrowserWorkflow.match(/actions\/upload-artifact@/g)?.length,
    1,
  );
  assert.match(liveBrowserWorkflow, /path: artifacts\/live-browser-smoke/);
  assert.match(liveBrowserWorkflow, /if-no-files-found: error/);
  assert.match(liveBrowserWorkflow, /retention-days: 14/);
  assert.doesNotMatch(liveBrowserWorkflow, /include-hidden-files:\s*true/);
});

test("generated architecture Dockerfiles match the source and keep one runtime entrypoint", async () => {
  const root = new URL("../", import.meta.url);
  const dockerfile = await readFile(new URL("Dockerfile", root), "utf8");
  const digest = createHash("sha256").update(dockerfile).digest("hex").slice(0, 16);

  // Catch structural drift even if both generated variants were edited by hand.
  assert.equal((dockerfile.match(/^FROM /gm) ?? []).length, 2);
  assert.equal((dockerfile.match(/^ARG SOPS_ENV=/gm) ?? []).length, 1);
  assert.equal((dockerfile.match(/^ENTRYPOINT /gm) ?? []).length, 1);
  assert.equal((dockerfile.match(/^CMD /gm) ?? []).length, 1);
  assert.match(dockerfile, /^ENTRYPOINT \["\/usr\/local\/bin\/sops-entrypoint\.sh", "\/docker-entrypoint\.sh"\]$/m);
  assert.match(dockerfile, /^CMD \["nginx", "-g", "daemon off;"\]$/m);

  for (const [architecture, platform] of [
    ["arm64", "linux/arm64"],
    ["x86-64", "linux/amd64"],
  ]) {
    const filename = `Dockerfile.${architecture}.dkf`;
    const generated = await readFile(new URL(filename, root), "utf8");
    // The approved pinned generator prepends this digest and rewrites each
    // external FROM with an explicit platform, then adds ARG TARGETARCH.
    // The current source has two external FROMs and no pre-existing platform.
    const lines = dockerfile.split("\n");
    let firstFrom = true;
    const pinned = lines.flatMap((line) => {
      if (!line.startsWith("FROM ")) return [line];
      const rewritten = `FROM --platform=${platform} ${line.slice(5)}`;
      if (firstFrom) {
        firstFrom = false;
        return [rewritten, "ARG TARGETARCH"];
      }
      return [rewritten];
    }).join("\n");
    const expected =
      `# GENERATED from Dockerfile (sha256:${digest}) by ores-gha-workflows/scripts/render-dkf.mjs — target ${platform}. Do not edit; edit Dockerfile and re-render.\n` +
      pinned;
    assert.equal(generated, expected, `${filename} does not match pinned render-dkf output`);
  }
});


test("live response preflight cannot mask the strict Chromium production failure", () => {
  assert.match(
    liveBrowserWorkflow,
    /name: Audit live security headers across routes\s*\n\s*run: node scripts\/audit-live-response-headers\.mjs\s*\n\s*continue-on-error: true/,
  );
  assert.match(liveBrowserWorkflow, /name: Execute deployed security policy in Chromium/);
  assert.doesNotMatch(
    liveBrowserWorkflow,
    /name: Execute deployed security policy in Chromium[\s\S]*?continue-on-error: true/,
  );
  assert.doesNotMatch(liveBrowserWorkflow, /node scripts\/audit-live-response-headers\.mjs\s*\|\|\s*true/);
});

test("live production smoke must verify both routes against approved team directory", () => {
  assert.match(liveBrowserWorkflow, /name: Verify live team directory on homepage and People page/);
  assert.ok(liveBrowserWorkflow.includes("run: node scripts/verify-live-people.mjs"));
  assert.ok(!liveBrowserWorkflow.includes("run: node scripts/verify-live-people.mjs\n        continue-on-error: true"));
});

test("production HTTPS curl commands use real shell continuations and retain TLS validation", async () => {
  const audit = await readFile(new URL("../scripts/audit-live-https.sh", import.meta.url), "utf8");
  const lines = audit.split("\n");
  assert.deepEqual(
    lines.filter((line) => line.endsWith("\\\\")),
    [],
    "a doubled trailing backslash quotes the backslash instead of continuing curl",
  );
  assert.match(audit, /--proto-redir '=https'/);
  assert.match(audit, /for route in \/ \/insights\/; do/);
  assert.match(audit, /--resolve "\$\{host\}:443:\$\{ip\}"/);
  const executableAudit = lines.filter((line) => !line.trimStart().startsWith("#") && !line.trimStart().startsWith("echo ")).join("\n");
  assert.doesNotMatch(executableAudit, /--insecure|--no-check-certificate/);
  assert.match(audit, /\$\{route_exit\}.*!= 0.*\$\{route_status\}.*!= 200/);
});


test("public HTTPS root and insights probes verify the page identity, not only HTTP 200", async () => {
  const audit = await readFile(new URL("../scripts/audit-live-https.sh", import.meta.url), "utf8");
  assert.match(audit, /for route in \/ \/insights\/; do/);
  assert.match(audit, /case "\$\{route\}" in/);
  assert.match(audit, /\/\)\s+expected_content='Startup security and compliance readiness'/);
  assert.match(audit, /\/insights\/\)\s+expected_content='Latest articles'/);
  assert.match(audit, /grep -qF -- "\$\{expected_content\}" "\$\{scratch\}\/route\.html"/);
  assert.match(audit, /if ! grep -qF[\s\S]+?exit 1\s+fi\s+done/);
  assert.doesNotMatch(audit, /grep -qF -- "\$\{expected_content\}"[^\n]*\|\|\s*true/);
  // Both marker strings must exist in the respective Astro page sources.
  const root = await readFile(new URL("../src/pages/index.astro", import.meta.url), "utf8");
  const insights = await readFile(new URL("../src/pages/insights/index.astro", import.meta.url), "utf8");
  assert.ok(root.includes('title="Startup security and compliance readiness"'));
  assert.ok(insights.includes("Latest articles"));
});

test("production HTTPS audit rejects redirects leaving the canonical URL and remains valid bash", async () => {
  const file = new URL("../scripts/audit-live-https.sh", import.meta.url);
  const audit = await readFile(file, "utf8");
  const syntax = spawnSync("bash", ["-n", fileURLToPath(file)], { encoding: "utf8" });
  assert.equal(syntax.status, 0, syntax.stderr);
  assert.equal((audit.match(/--write-out '%\{http_code\}\\t%\{url_effective\}'/g) ?? []).length, 2,
    "both blog and root/insights probes must record HTTP code plus effective redirect target");
  assert.ok(audit.includes("final_url=\"${public_info#*$'\\t'}\""));
  assert.ok(audit.includes("route_final_url=\"${route_info#*$'\\t'}\""));
  assert.ok(audit.includes('"${final_url}" != "${public_url}"'));
  assert.ok(audit.includes('"${route_final_url}" != "https://${host}${route}"'));
  assert.ok(audit.includes("--proto-redir '=https'"));
  const executable = audit.split("\n").filter((line) => !line.trimStart().startsWith("#") && !line.trimStart().startsWith("echo ")).join("\n");
  assert.doesNotMatch(executable, /--insecure|--no-check-certificate/);
});

test("production HTTPS smoke rejects cross-origin redirects even with valid HTTP 200 page content", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "canonical-https-redirect-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const mockCurl = ["#!/usr/bin/env bash","set -euo pipefail","url=''; out=''; headers=''; format=''","while (( $# )); do","  case \"$1\" in","    --output) out=\"$2\"; shift 2 ;;","    --dump-header) headers=\"$2\"; shift 2 ;;","    --write-out) format=\"$2\"; shift 2 ;;","    https://*) url=\"$1\"; shift ;;","    *) shift ;;","  esac","done","case \"$url\" in","  https://canonical.plus/blogs/1/) body='How C++26 becomes an ISO standard' ;;","  https://canonical.plus/insights/) body='Latest articles' ;;","  https://canonical.plus/) body='Startup security and compliance readiness' ;;","  *) exit 77 ;;","esac","if [[ -n \"$out\" ]]; then printf '%s' \"$body\" >\"$out\"; fi","if [[ -n \"$headers\" ]]; then printf 'HTTP/2 200\\r\\ncontent-type: text/html\\r\\n' >\"$headers\"; fi","effective=\"$url\"","if [[ \"${FAKE_HTTPS_MODE:-ok}\" == bad_blog && \"$url\" == */blogs/1/ ]]; then effective='https://outside.invalid/blogs/1/'; fi","if [[ \"${FAKE_HTTPS_MODE:-ok}\" == bad_root && \"$url\" == 'https://canonical.plus/' ]]; then effective='https://outside.invalid/'; fi","if [[ \"${FAKE_HTTPS_MODE:-ok}\" == bad_insights && \"$url\" == */insights/ ]]; then effective='https://outside.invalid/insights/'; fi","if [[ \"$format\" == *url_effective* ]]; then printf '200\\t%s' \"$effective\"; else printf '200'; fi"].join("\n") + "\n";
  writeFileSync(join(dir, "curl"), mockCurl);
  writeFileSync(join(dir, "dig"), "#!/bin/sh\nexit 0\n");
  writeFileSync(join(dir, "openssl"), "#!/bin/sh\nexit 0\n");
  for (const name of ["curl", "dig", "openssl"]) chmodSync(join(dir, name), 0o755);
  const audit = fileURLToPath(new URL("../scripts/audit-live-https.sh", import.meta.url));
  for (const [mode, expectedExit] of [["ok", 0], ["bad_blog", 1], ["bad_root", 1], ["bad_insights", 1]]) {
    const outcome = spawnSync("bash", [audit], {
      encoding: "utf8", timeout: 15000,
      env: { ...process.env, PATH: dir + ":" + process.env.PATH, TMPDIR: dir, FAKE_HTTPS_MODE: mode },
    });
    assert.equal(outcome.status, expectedExit, mode + ": " + outcome.stdout + "\n" + outcome.stderr);
    if (expectedExit !== 0) assert.match(outcome.stdout + outcome.stderr, /::error::Public HTTPS/);
  }
});
