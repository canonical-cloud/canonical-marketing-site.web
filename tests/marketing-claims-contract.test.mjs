import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const paths = [
  "../README.md",
  "../src/layouts/BaseLayout.astro",
  "../src/pages/index.astro",
  "../src/pages/readiness.astro",
  "../src/pages/frameworks.astro",
  "../src/pages/compare.astro",
];

const corpus = (
  await Promise.all(paths.map((path) => readFile(new URL(path, import.meta.url), "utf8")))
).join("\n");

test("public copy never presents readiness as an independent audit or certification", () => {
  for (const prohibited of [
    /Now Accepting Audit Engagements/i,
    /Start Your Audit/i,
    /Compliance Audits\s*Without the Overhead/i,
    /experienced CPAs/i,
    /licensed CPA/i,
    /SOC 2 Attestation/i,
    /FedRAMP Authorization/i,
    /100%\s*First-Pass Success Rate/i,
    /Lower Cost vs Big 4/i,
    /got us SOC 2 Type II in 6 weeks/i,
    /James Rodriguez/i,
    /HIPAA certified/i,
  ]) {
    assert.doesNotMatch(corpus, prohibited);
  }

  assert.match(corpus, /Readiness, not independent assurance/);
  assert.match(corpus, /do not issue audit opinions, certifications, or regulatory approvals/i);
  assert.match(corpus, /Independent auditors, assessors, certification bodies, regulators, and legal counsel/);
});

test("public comparison acknowledges current product limits", () => {
  assert.match(corpus, /not positioned as a mature hundreds-of-integrations continuous-monitoring suite/);
  assert.match(corpus, /should be selected for its current strengths—not for capabilities it has not yet proven/);
  assert.match(corpus, /Vendor capabilities and commercial terms change/);
});

test("framework copy keeps qualified independent roles explicit", () => {
  for (const role of ["auditor", "certification body", "3PAO", "C3PAO", "QSA", "regulator", "legal adviser"]) {
    assert.match(corpus, new RegExp(role, "i"));
  }
});
