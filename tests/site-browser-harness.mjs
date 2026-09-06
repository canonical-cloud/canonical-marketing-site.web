// Self-contained boot recipe for the marketing-site browser e2e.
//
// canonical-marketing-site.web has no shared test-config package, so Chrome
// discovery and the static-server lifecycle both live here, next to the specs
// that use them.
import { once } from "node:events";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DIST_ROOT = fileURLToPath(new URL("../dist/", import.meta.url));
const CONTENT_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
});

// Resolve a Chrome/Chromium executable for Playwright/Puppeteer.
//
// Prefer an explicit env var (set by the Nix dev shell or CI), then a few
// well-known system paths. Returning `undefined` lets Puppeteer fall back to its
// own downloaded browser; Playwright likewise falls back to its managed build.
export function chromeExecutablePath() {
  const fromEnv =
    process.env.PLAYWRIGHT_CHROMIUM ||
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_PATH ||
    process.env.CHROMIUM_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

const fileForPath = (pathname) => {
  const relativePath = pathname.endsWith("/")
    ? `${pathname.slice(1)}index.html`
    : pathname.slice(1);
  const candidate = resolve(DIST_ROOT, relativePath);
  const relationship = relative(DIST_ROOT, candidate);
  return relationship === ".." || relationship.startsWith(`..${sep}`)
    ? null
    : candidate;
};

const status = (response, code) => {
  response.writeHead(code, {
    "cache-control": "no-store",
    "content-type": "text/plain; charset=utf-8",
  });
  response.end();
};

const serveStaticRequest = async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    status(response, 405);
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
  } catch {
    status(response, 400);
    return;
  }

  const file = fileForPath(pathname);
  if (file === null) {
    status(response, 404);
    return;
  }

  try {
    const body = await readFile(file);
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-length": String(body.length),
      "content-type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    status(response, error?.code === "ENOENT" ? 404 : 500);
  }
};

// Boots the bounded in-process static server on an ephemeral port.
//
// The site is built with base `/` (astro.config.mjs), so pages are served at
// `${url}/`. Set CANONICAL_SITE_TEST_URL to run against an already-running site.
export async function startSite() {
  const reuse = process.env.CANONICAL_SITE_TEST_URL;
  if (reuse) {
    return { url: reuse.replace(/\/+$/, ""), stop: () => {} };
  }

  const server = createServer((request, response) => {
    serveStaticRequest(request, response).catch(() => status(response, 500));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (address === null || typeof address === "string") {
    await new Promise((resolve) => server.close(resolve));
    throw new Error("static test server did not expose a TCP address");
  }

  let stopped = false;
  const stop = () => {
    if (stopped) return Promise.resolve();
    stopped = true;
    return new Promise((resolveStop, rejectStop) => {
      server.close((error) => (error ? rejectStop(error) : resolveStop()));
      // Playwright route.fetch() may retain a keep-alive socket after the test
      // has completed. Closing owned sockets makes teardown deterministic on
      // both local macOS and hosted Linux runners.
      server.closeAllConnections();
    });
  };

  return { url: `http://127.0.0.1:${address.port}`, stop };
}
