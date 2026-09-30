import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const readiness = await readFile(new URL("../src/pages/readiness.astro", import.meta.url), "utf8");
const catalog = JSON.parse(
  await readFile(new URL("../src/data/service-tiers.json", import.meta.url), "utf8"),
);

test("readiness renders every canonical service tier from the shared catalog", () => {
  assert.match(readiness, /import catalog from '\.\.\/data\/service-tiers\.json'/);
  assert.match(readiness, /catalog\.tiers\.map/);
  assert.match(readiness, /money\.format\(tier\.monthlyUsd\)/);

  assert.deepEqual(
    catalog.tiers.map(({ id, name, monthlyUsd }) => ({ id, name, monthlyUsd })),
    [
      { id: "foundation-readiness", name: "Foundation Readiness", monthlyUsd: 2500 },
      { id: "managed-readiness", name: "Managed Readiness", monthlyUsd: 7500 },
      { id: "assurance-engineering", name: "Assurance Engineering", monthlyUsd: 20000 },
    ],
  );
});

test("readiness pricing keeps commercial and assurance boundaries explicit", () => {
  assert.match(readiness, /publicationStatus/);
  assert.match(readiness, /signed statement of work/);
  assert.match(readiness, /Full pricing details/);
  assert.match(readiness, /audit opinion, certification/);
  assert.doesNotMatch(readiness, /guaranteed (?:audit|certification)/i);
});
