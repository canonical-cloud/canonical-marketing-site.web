import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, writeFile, mkdir, mkdtemp, copyFile, rm } from "node:fs/promises";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildManifest, validateManifest, verifyRelease, PAGES, ORIGIN } from "../scripts/release-manifest.mjs";

const revision = "a".repeat(40);
const contents = PAGES.map(({ path }) => Buffer.from(`<html><h1>Readiness ${path}</h1></html>`));
const manifest = buildManifest(contents, revision);
function transport(change = () => undefined) {
  const calls = [];
  return { calls, fetch: async (input, options) => {
    const url = new URL(input);
    calls.push({ url, options });
    const replacement = change(url, options, calls.length);
    if (replacement) return replacement;
    if (url.pathname === "/release.json") {
      return new Response(JSON.stringify(manifest), { headers: { "content-type": "application/json" } });
    }
    const index = PAGES.findIndex(({ path }) => path === url.pathname);
    assert.ok(index >= 0, "checker must not contact unlisted paths");
    return new Response(contents[index], { headers: { "content-type": "text/html; charset=utf-8" } });
  } };
}

test("manifest is deterministic, immutable, and contains no timestamp or environment", () => {
  assert.deepEqual(buildManifest(contents, revision), manifest);
  assert.ok(Object.isFrozen(manifest) && Object.isFrozen(manifest.pages) && Object.isFrozen(manifest.pages[0]));
  assert.deepEqual(Object.keys(manifest).sort(), ["pages", "repository", "schemaVersion", "sourceRevision"]);
  assert.equal(buildManifest(contents, null).sourceRevision, null);
});
test("source-revision and page-byte constraints fail closed", () => {
  for (const value of ["main", "a".repeat(39), "A".repeat(40), "../../secret", 123, undefined]) {
    assert.throws(() => buildManifest(contents, value), /INVALID_REVISION/);
  }
  assert.throws(() => buildManifest([], revision), /INVALID_PAGE_SET/);
  assert.throws(() => buildManifest(["text", ...contents.slice(1)], revision), /INVALID_PAGE_BYTES/);
  assert.throws(() => buildManifest([Buffer.alloc(0), ...contents.slice(1)], revision), /INVALID_PAGE_SIZE/);
});
test("successful verification checks every page with five credential-free GETs", async () => {
  const mock = transport();
  assert.deepEqual(await verifyRelease(revision, mock.fetch), { status: "PASS", sourceRevision: revision, pagesChecked: 4 });
  assert.equal(mock.calls.length, 5);
  for (const { url, options } of mock.calls) {
    assert.equal(url.origin, ORIGIN);
    assert.equal(url.searchParams.get("canonical_release"), revision);
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "manual");
    assert.equal(options.credentials, "omit");
    assert.equal(options.cache, "no-store");
    assert.equal(options.body, undefined);
    assert.deepEqual(Object.keys(options.headers), ["accept"]);
    assert.ok(options.signal instanceof AbortSignal);
  }
});
for (const status of [301, 302, 307, 308, 401, 404, 500, 503]) {
  test(`HTTP ${status} is not a successful release`, async () => {
    const mock = transport(() => new Response(null, { status, headers: { location: "https://evil.invalid" } }));
    await assert.rejects(verifyRelease(revision, mock.fetch), /UNEXPECTED_HTTP_STATUS/);
    assert.equal(mock.calls.length, 1);
  });
}
for (const [name, change, error] of [
  ["stale", (m) => { m.sourceRevision = "b".repeat(40); }, "STALE_OR_UNVERSIONED_RELEASE"],
  ["unversioned", (m) => { m.sourceRevision = null; }, "STALE_OR_UNVERSIONED_RELEASE"],
  ["wrong repo", (m) => { m.repository = "other/repo"; }, "WRONG_MANIFEST_SOURCE"],
  ["unknown schema", (m) => { m.schemaVersion = 2; }, "WRONG_MANIFEST_SOURCE"],
  ["unknown field", (m) => { m.target = "https://evil.invalid"; }, "INVALID_MANIFEST"],
  ["missing page", (m) => { m.pages.pop(); }, "INVALID_PAGE_SET"],
  ["duplicate page", (m) => { m.pages[1] = m.pages[0]; }, "INVALID_PAGE_SET"],
  ["external page", (m) => { m.pages[0].path = "https://evil.invalid/"; }, "INVALID_PAGE_SET"],
  ["path traversal", (m) => { m.pages[0].path = "/../private"; }, "INVALID_PAGE_SET"],
  ["invalid hash", (m) => { m.pages[0].sha256 = "x"; }, "INVALID_PAGE_SET"],
]) {
  test(`rejects ${name} manifest before page requests`, async () => {
    const value = structuredClone(manifest); change(value);
    assert.throws(() => validateManifest(value, revision), new RegExp(error));
    const mock = transport(() => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } }));
    await assert.rejects(verifyRelease(revision, mock.fetch), new RegExp(error));
    assert.equal(mock.calls.length, 1);
  });
}
test("mixed release: a matching marker cannot conceal stale HTML", async () => {
  const mock = transport((url) => url.pathname === "/readiness/" ?
    new Response("old page", { headers: { "content-type": "text/html" } }) : undefined);
  await assert.rejects(verifyRelease(revision, mock.fetch), /DEPLOYED_CONTENT_MISMATCH/);
});
test("HTML fallback cannot masquerade as the JSON release marker", async () => {
  const mock = transport(() => new Response("<html>fallback</html>", { headers: { "content-type": "text/html" } }));
  await assert.rejects(verifyRelease(revision, mock.fetch), /UNEXPECTED_CONTENT_TYPE/);
});
test("malformed JSON produces a content-free error", async () => {
  const mock = transport(() => new Response("synthetic-private-body", { headers: { "content-type": "application/json" } }));
  await assert.rejects(verifyRelease(revision, mock.fetch), /^ReleaseCheckError: INVALID_MANIFEST_JSON$/);
});
test("declared and streamed body limits are both enforced", async () => {
  for (const headers of [{ "content-length": "999999" }, {}]) {
    const mock = transport(() => new Response("x".repeat(17000), { headers: { "content-type": "application/json", ...headers } }));
    await assert.rejects(verifyRelease(revision, mock.fetch), /RESPONSE_TOO_LARGE/);
  }
});
test("network failure does not disclose raw upstream errors", async () => {
  await assert.rejects(verifyRelease(revision, async () => { throw new Error("synthetic-sensitive-value"); }),
    /^ReleaseCheckError: NETWORK_OR_STREAM_FAILURE$/);
});
test("invalid expected revision performs no network call", async () => {
  let calls = 0;
  await assert.rejects(verifyRelease("main", async () => { calls += 1; }), /INVALID_EXPECTED_REVISION/);
  assert.equal(calls, 0);
});
test("package wires stamping and hermetic tests, not live probing, into normal builds", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.scripts.postbuild, "node scripts/release-manifest.mjs stamp");
  assert.ok(pkg.scripts.test.includes("tests/release-manifest.test.mjs"));
  assert.doesNotMatch(pkg.scripts.test, /verify:release|release-manifest\.mjs verify/);
});


async function cliFixture(t) {
  const root = await mkdtemp(join(tmpdir(), "canonical-release-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = join(root, "site");
  await mkdir(join(project, "scripts"), { recursive: true });
  await copyFile(new URL("../scripts/release-manifest.mjs", import.meta.url), join(project, "scripts/release-manifest.mjs"));
  for (const [index, { file }] of PAGES.entries()) {
    await mkdir(join(project, "dist", file, ".."), { recursive: true });
    await writeFile(join(project, "dist", file), contents[index]);
  }
  await writeFile(join(project, ".gitignore"), "dist/\n");
  const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
  const git = (cwd, args) => execFileSync("git", args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const init = (cwd) => {
    git(cwd, ["init", "--template=", "-q"]);
    git(cwd, ["add", "."]);
    git(cwd, ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--no-verify", "-qm", "synthetic fixture"]);
    return git(cwd, ["rev-parse", "HEAD"]);
  };
  const stamp = async () => {
    const result = spawnSync(process.execPath, ["scripts/release-manifest.mjs", "stamp"], { cwd: project, env, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(await readFile(join(project, "dist/release.json"), "utf8"));
    assert.deepEqual(JSON.parse(result.stdout), { status: "STAMPED", sourceRevision: output.sourceRevision, pages: 4 });
    return output;
  };
  return { root, project, init, stamp };
}

test("CLI stamp publishes real page hashes and a clean checkout revision", async (t) => {
  const fixture = await cliFixture(t);
  const head = fixture.init(fixture.project);
  assert.deepEqual(await fixture.stamp(), buildManifest(contents, head));
  assert.deepEqual(await fixture.stamp(), buildManifest(contents, head), "repeat stamp remains deterministic");
});
test("CLI stamp marks exported or parent-repository snapshots unversioned", async (t) => {
  const fixture = await cliFixture(t);
  assert.equal((await fixture.stamp()).sourceRevision, null);
  fixture.init(fixture.root);
  assert.equal((await fixture.stamp()).sourceRevision, null, "a surrounding repository cannot supply this project's identity");
});
test("CLI stamp rejects tracked and untracked source drift as release identity", async (t) => {
  const fixture = await cliFixture(t);
  fixture.init(fixture.project);
  await writeFile(join(fixture.project, "unpublished.txt"), "synthetic change");
  assert.equal((await fixture.stamp()).sourceRevision, null);
  await rm(join(fixture.project, "unpublished.txt"));
  await writeFile(join(fixture.project, ".gitignore"), "dist/\nnew-unpublished-output/\n");
  assert.equal((await fixture.stamp()).sourceRevision, null);
});
test("CLI rejects incomplete output without creating a successful manifest", async (t) => {
  const fixture = await cliFixture(t);
  await rm(join(fixture.project, "dist/compare/index.html"));
  const result = spawnSync(process.execPath, ["scripts/release-manifest.mjs", "stamp"], { cwd: fixture.project, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stderr), { status: "FAIL", code: "BUILD_IO_FAILURE" });
  assert.equal(result.stdout, "");
  await assert.rejects(readFile(join(fixture.project, "dist/release.json")), { code: "ENOENT" });
});
