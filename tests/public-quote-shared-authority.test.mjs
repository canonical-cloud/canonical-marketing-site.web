import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const pin = JSON.parse(await readFile(new URL("src/data/quote-estimator.contract.json", root), "utf8"));
const local = JSON.parse(await readFile(new URL("src/data/quote-estimator.json", root), "utf8"));

const governedProjection = (value) => {
  if (Array.isArray(value)) return value.map(governedProjection);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "note")
        .map(([key, nested]) => [key, governedProjection(nested)]),
    );
  }
  return value;
};

test("public quote estimator authority pin is immutable and explicit", () => {
  assert.equal(pin.schemaVersion, 1);
  assert.equal(pin.authorityRepository, "canonical-cloud/canonical-interfaces");
  assert.match(pin.authorityRevision, /^[0-9a-f]{40}$/);
  assert.equal(pin.contractId, "urn:canonical-cloud:public-quote-estimator:v2");
  assert.equal(
    pin.authorityFixturePath,
    "contracts/public-quote-estimator/v2/instances/PublicQuoteEstimatorConfig/valid/current.json",
  );
  assert.equal(pin.authoritySchemaPath, "contracts/public-quote-estimator/v2/authored.schema.json");
  assert.equal(pin.authorityTypeSpecPath, "contracts/public-quote-estimator/v2/main.tsp");
});

test("local estimator explanatory notes remain non-empty presentation copy", () => {
  for (const item of [...local.speeds, ...local.deliveryDepths, ...local.complexities]) {
    assert.equal(typeof item.note, "string");
    assert.ok(item.note.trim().length > 0);
  }
});

test(
  "marketing estimator governed projection matches pinned canonical authority",
  { skip: !process.env.CANONICAL_QUOTE_AUTHORITY_FIXTURE },
  async () => {
    const authority = JSON.parse(
      await readFile(process.env.CANONICAL_QUOTE_AUTHORITY_FIXTURE, "utf8"),
    );
    assert.deepEqual(governedProjection(local), governedProjection(authority));
  },
);
