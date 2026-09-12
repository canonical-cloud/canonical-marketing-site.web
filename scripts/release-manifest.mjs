import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export const REPOSITORY = "canonical-cloud/canonical-marketing-site.web";
export const ORIGIN = "https://canonical.plus";
export const PAGES = Object.freeze([
  Object.freeze({ path: "/", file: "index.html" }),
  Object.freeze({ path: "/readiness/", file: "readiness/index.html" }),
  Object.freeze({ path: "/frameworks/", file: "frameworks/index.html" }),
  Object.freeze({ path: "/compare/", file: "compare/index.html" }),
]);
const SHA = /^[0-9a-f]{40}$/;
const HASH = /^[0-9a-f]{64}$/;
const ROOT = new URL("../", import.meta.url);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export class ReleaseCheckError extends Error {
  constructor(code) { super(code); this.name = "ReleaseCheckError"; this.code = code; }
}
const requireCheck = (condition, code) => {
  if (!condition) throw new ReleaseCheckError(code);
};
const exactKeys = (value, keys) => {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).sort().join(",") === [...keys].sort().join(",");
};

/** Pure, deterministic content identity; never a signature or deployment claim. */
export function buildManifest(contents, revision) {
  requireCheck(revision === null || (typeof revision === "string" && SHA.test(revision)), "INVALID_REVISION");
  requireCheck(Array.isArray(contents) && contents.length === PAGES.length, "INVALID_PAGE_SET");
  const pages = PAGES.map(({ path }, index) => {
    requireCheck(Buffer.isBuffer(contents[index]), "INVALID_PAGE_BYTES");
    requireCheck(contents[index].length > 0 && contents[index].length <= 2 * 1024 * 1024, "INVALID_PAGE_SIZE");
    return Object.freeze({ path, sha256: sha256(contents[index]) });
  });
  return Object.freeze({ schemaVersion: 1, repository: REPOSITORY,
    sourceRevision: revision, pages: Object.freeze(pages) });
}

export function validateManifest(value, expectedRevision) {
  requireCheck(typeof expectedRevision === "string" && SHA.test(expectedRevision), "INVALID_EXPECTED_REVISION");
  requireCheck(exactKeys(value, ["schemaVersion", "repository", "sourceRevision", "pages"]), "INVALID_MANIFEST");
  requireCheck(value.schemaVersion === 1 && value.repository === REPOSITORY, "WRONG_MANIFEST_SOURCE");
  requireCheck(value.sourceRevision === expectedRevision, "STALE_OR_UNVERSIONED_RELEASE");
  requireCheck(Array.isArray(value.pages) && value.pages.length === PAGES.length, "INVALID_PAGE_SET");
  for (const [index, page] of value.pages.entries()) {
    requireCheck(exactKeys(page, ["path", "sha256"]) && page.path === PAGES[index].path &&
      typeof page.sha256 === "string" && HASH.test(page.sha256), "INVALID_PAGE_SET");
  }
  return value;
}

async function readResponse(response, mime, limit) {
  requireCheck(response.status === 200 && !response.redirected, "UNEXPECTED_HTTP_STATUS");
  requireCheck(response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() === mime,
    "UNEXPECTED_CONTENT_TYPE");
  const declared = response.headers.get("content-length");
  if (declared !== null) {
    requireCheck(/^\d+$/.test(declared) && Number(declared) <= limit, "RESPONSE_TOO_LARGE");
  }
  requireCheck(response.body !== null, "EMPTY_RESPONSE");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      requireCheck(size <= limit, "RESPONSE_TOO_LARGE");
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

/** GET-only external signal. No credentials, redirects, writes, or arbitrary targets. */
export async function verifyRelease(expectedRevision, fetchImpl = globalThis.fetch) {
  requireCheck(typeof expectedRevision === "string" && SHA.test(expectedRevision), "INVALID_EXPECTED_REVISION");
  const get = async (path, mime, limit) => {
    const url = new URL(path, ORIGIN);
    url.searchParams.set("canonical_release", expectedRevision);
    let response;
    try {
      response = await fetchImpl(url, { method: "GET", redirect: "manual", credentials: "omit",
        cache: "no-store", headers: { accept: mime }, signal: AbortSignal.timeout(8000) });
      if (response.url) requireCheck(new URL(response.url).origin === ORIGIN, "WRONG_RESPONSE_ORIGIN");
      return await readResponse(response, mime, limit);
    } catch (error) {
      if (error instanceof ReleaseCheckError) throw error;
      throw new ReleaseCheckError("NETWORK_OR_STREAM_FAILURE");
    } finally {
      if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {});
    }
  };
  const raw = await get("/release.json", "application/json", 16 * 1024);
  let manifest;
  try { manifest = JSON.parse(raw.toString("utf8")); }
  catch { throw new ReleaseCheckError("INVALID_MANIFEST_JSON"); }
  validateManifest(manifest, expectedRevision);
  for (const page of manifest.pages) {
    const bytes = await get(page.path, "text/html", 2 * 1024 * 1024);
    requireCheck(sha256(bytes) === page.sha256, "DEPLOYED_CONTENT_MISMATCH");
  }
  return Object.freeze({ status: "PASS", sourceRevision: expectedRevision, pagesChecked: PAGES.length });
}

function cleanCheckoutRevision() {
  try {
    const options = { cwd: fileURLToPath(ROOT), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 };
    const topLevel = execFileSync("git", ["rev-parse", "--show-toplevel"], options).trim();
    if (realpathSync(topLevel) !== realpathSync(fileURLToPath(ROOT))) return null;
    const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], options);
    if (status.trim()) return null;
    const revision = execFileSync("git", ["rev-parse", "HEAD"], options).trim();
    return SHA.test(revision) ? revision : null;
  } catch { return null; }
}

async function main(args) {
  if (args.length === 1 && args[0] === "stamp") {
    const contents = await Promise.all(PAGES.map(({ file }) => readFile(new URL(`dist/${file}`, ROOT))));
    const manifest = buildManifest(contents, cleanCheckoutRevision());
    await writeFile(new URL("dist/release.json", ROOT), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 });
    console.log(JSON.stringify({ status: "STAMPED", sourceRevision: manifest.sourceRevision, pages: PAGES.length }));
    return;
  }
  if (args.length === 2 && args[0] === "verify") {
    console.log(JSON.stringify(await verifyRelease(args[1])));
    return;
  }
  throw new ReleaseCheckError("USAGE: release-manifest.mjs stamp | verify <expected-40-hex-revision>");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main(process.argv.slice(2)).catch((error) => {
    // Provider errors and bodies may contain data; print only our stable failure code.
    console.error(JSON.stringify({ status: "FAIL", code: error instanceof ReleaseCheckError ? error.code : "BUILD_IO_FAILURE" }));
    process.exitCode = 1;
  });
}
