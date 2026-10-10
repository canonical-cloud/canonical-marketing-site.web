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

test("new pre-audit sections demonstrate real outputs without false audit or integration claims", async () => {
  const [home, readiness, frameworks, compare, quote, styles] = await Promise.all([
    "index.astro", "readiness.astro", "frameworks.astro", "compare.astro", "quote.astro"
  ].map((path) => readFile(new URL(`src/pages/${path}`, root), "utf8")).concat([
    readFile(new URL("src/styles/marketing-pages.css", root), "utf8"),
  ]));

  assert.ok(home.includes('id="readiness-preview"'));
  for (const output of ["Scope map", "Gap register", "Remediation roadmap", "Evidence-readiness index"]) {
    assert.ok(home.includes(output), `home missing ${output}`);
  }
  assert.ok(home.includes('#sample-finding'));

  assert.ok(readiness.includes('id="sample-finding"'));
  assert.ok(readiness.includes('This fictional IAM example'));
  assert.ok(readiness.includes('not an independent auditor'));
  assert.ok(readiness.includes('id="evidence-readiness"'));
  for (const label of ["Not implemented", "Partially implemented", "Implemented; evidence missing", "Evidence stale or incomplete", "Unverified", "Out of scope (documented)"]) {
    assert.ok(readiness.includes(label), `readiness missing ${label}`);
  }

  assert.ok(frameworks.includes('id="starter-checklists"'));
  for (const id of ["soc2", "iso27001", "hipaa", "pci-dss", "nist-csf"]) {
    assert.ok(frameworks.includes(`id: '${id}'`), `framework guide missing ${id}`);
  }
  assert.ok(frameworks.includes('There is no general HHS HIPAA certification'));
  assert.ok(frameworks.includes('The CSF is not itself an audit certificate'));

  assert.ok(compare.includes('id="existing-platforms"'));
  for (const vendor of ["Vanta", "Drata", "Secureframe"]) assert.ok(compare.includes(vendor));
  assert.ok(compare.includes('not a claim of a native integration or feature parity'));
  assert.ok(compare.includes('no claim of partnership, endorsement, API integration'));

  assert.ok(quote.includes('id="quote-scope-summary"'));
  assert.ok(quote.includes('Not included by default:'));
  assert.ok(quote.includes('signed SOW'));
  assert.ok(quote.includes('id="quote-estimate-book-intro"'));
  assert.ok(quote.includes("https://calendly.com/hello-canonical/30min"));

  for (const selector of [".readiness-preview-grid", ".readiness-finding", ".starter-guide", ".quote-scope"]) {
    assert.ok(styles.includes(selector), `missing responsive presentation for ${selector}`);
  }
});
