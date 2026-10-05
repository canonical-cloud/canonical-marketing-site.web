import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);

const collectAstro = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) files.push(...await collectAstro(target));
    else if (entry.name.endsWith(".astro")) files.push(target);
  }
  return files;
};

const publicPages = await collectAstro(new URL("src/pages/", root));
const corpus = (
  await Promise.all([
    readFile(new URL("README.md", root), "utf8"),
    readFile(new URL("src/layouts/BaseLayout.astro", root), "utf8"),
    ...publicPages.map((url) => readFile(url, "utf8")),
  ])
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

  assert.match(corpus, /Canonical supports readiness and pre-audits/i);
  assert.match(corpus, /qualified independent auditor, assessor, certification body, regulator, or legal adviser makes that determination/i);
  assert.match(corpus, /independent assurance/i);
});

test("public comparison acknowledges current product limits", () => {
  assert.match(corpus, /not positioned as a mature hundreds-of-integrations continuous-monitoring suite/);
  assert.match(corpus, /should complement those workflows where they fit rather\s+than imply feature parity with mature automation suites/);
  assert.match(corpus, /Vendor capabilities and commercial terms change/);
});

test("framework copy keeps qualified independent roles explicit", () => {
  for (const role of ["auditor", "certification body", "3PAO", "C3PAO", "QSA", "regulator", "legal adviser"]) {
    assert.match(corpus, new RegExp(role, "i"));
  }
});
