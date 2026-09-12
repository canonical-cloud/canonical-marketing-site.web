import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const graph = JSON.parse(await read('../contracts/training-graph/v1/instances/TrainingGraph/valid/canonical.json'));
const prices = JSON.parse(await read('../src/data/service-tiers.json'));
const pricesPage = await read('../src/pages/prices.astro');
const pricingPage = await read('../src/pages/pricing.astro');
const trainingPage = await read('../src/pages/training.astro');
const peoplePage = await read('../src/pages/people.astro');
const securityPage = await read('../src/pages/security.astro');
const contactPage = await read('../src/pages/contact.astro');
const baseLayout = await read('../src/layouts/BaseLayout.astro');
const typeSpec = await read('../contracts/training-graph/v1/main.tsp');
const authoredSchema = JSON.parse(await read('../contracts/training-graph/v1/authored.schema.json'));
const workflow = await read('../.github/workflows/training-graph-contract.yml').catch(() => '');

test('public pricing projects the reviewed Canonical commercial contract exactly', () => {
  assert.deepEqual(prices.source, {
    repository: 'canonical-cloud/canonical-interfaces',
    revision: '85c3aaf4e849cdf38a7c1b3bc0aac546314ef887',
    contract: 'contracts/commercial-service-tier/v1',
    publicationStatus: 'proposed',
    currency: 'USD',
    asOf: '2026-09-11',
  });
  assert.deepEqual(
    prices.tiers.map(({ id, name, monthlyUsd }) => ({ id, name, monthlyUsd })),
    [
      { id: 'foundation-readiness', name: 'Foundation Readiness', monthlyUsd: 2500 },
      { id: 'managed-readiness', name: 'Managed Readiness', monthlyUsd: 7500 },
      { id: 'assurance-engineering', name: 'Assurance Engineering', monthlyUsd: 20000 },
    ],
  );
  for (const page of [pricesPage, pricingPage]) {
    assert.match(page, /proposed starting prices/i);
    assert.match(page, /signed statement of work/i);
    assert.match(page, /No package promises an audit opinion, certification, authorization, legal conclusion/i);
    assert.match(page, /mailto:hello@canonical\.plus/);
  }
});

test('people, pricing, training, and security routes are concrete public pages', () => {
  assert.match(peoplePage, /<BaseLayout/);
  assert.match(pricingPage, /<BaseLayout/);
  assert.match(trainingPage, /<BaseLayout/);
  assert.match(securityPage, /<BaseLayout/);
  assert.match(securityPage, /security readiness/i);
  assert.match(securityPage, /independent party/i);
});

test('global discovery and contact use the canonical.plus hello address', () => {
  for (const route of ['/people/', '/pricing/', '/training/', '/security/', '/contact/']) {
    assert.ok(baseLayout.includes(route), `footer must expose ${route}`);
  }
  assert.match(baseLayout, /mailto:hello@canonical\.plus/);
  assert.match(contactPage, /hello@canonical\.plus/);
  assert.match(contactPage, /Start readiness assessment/);
  for (const source of [baseLayout, pricesPage, pricingPage, securityPage, contactPage]) {
    assert.doesNotMatch(source, /compliance@canonical\.(?:plus|cloud)/i);
  }
});

test('training graph has unique nodes, valid edges, full reachability, and a real cycle', () => {
  assert.equal(graph.schemaVersion, '1.0.0');
  assert.equal(graph.graphId, 'canonical-compliance-training-v1');

  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  assert.equal(byId.size, graph.nodes.length, 'node ids must be unique');
  assert.ok(byId.has(graph.entryNodeId), 'entry node must exist');

  for (const node of graph.nodes) {
    assert.ok(node.choices.length > 0, `${node.id}: every node must offer a next choice`);
    assert.ok(node.checkpoints.some((checkpoint) => checkpoint.required), `${node.id}: at least one checkpoint must be required`);
    const choiceIds = new Set();
    for (const choice of node.choices) {
      assert.ok(!choiceIds.has(choice.id), `${node.id}: duplicate choice id ${choice.id}`);
      choiceIds.add(choice.id);
      assert.ok(byId.has(choice.nextNodeId), `${node.id}: missing edge destination ${choice.nextNodeId}`);
    }
  }

  const reached = new Set();
  const visit = (id) => {
    if (reached.has(id)) return;
    reached.add(id);
    for (const choice of byId.get(id).choices) visit(choice.nextNodeId);
  };
  visit(graph.entryNodeId);
  assert.equal(reached.size, graph.nodes.length, 'every node must be reachable from the entry node');

  const visiting = new Set();
  const visited = new Set();
  const hasCycle = (id) => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const choice of byId.get(id).choices) {
      if (hasCycle(choice.nextNodeId)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  assert.equal(hasCycle(graph.entryNodeId), true, 'training graph must remain intentionally cyclical');
});

test('training outcomes map to the same three public readiness tiers', () => {
  const outcomes = graph.nodes
    .filter((node) => node.kind === 'outcome')
    .map((node) => node.outcome?.tierId)
    .filter(Boolean)
    .sort();
  assert.deepEqual(outcomes, ['assurance-engineering', 'foundation-readiness', 'managed-readiness']);
});

test('training SPA uses query-string deep links and safe DOM construction', () => {
  assert.match(trainingPage, /searchParams\.get\('node'\)/);
  assert.match(trainingPage, /history\.pushState/);
  assert.match(trainingPage, /history\.replaceState/);
  assert.match(trainingPage, /popstate/);
  assert.doesNotMatch(trainingPage, /location\.hash|#node=/);
  assert.doesNotMatch(trainingPage, /innerHTML/);
  assert.match(trainingPage, /textContent/);
  assert.match(trainingPage, /type = 'checkbox'/);
  assert.match(trainingPage, /no account required/i);
});

test('TypeSpec and JSON Schema expose matching training declarations', () => {
  for (const declaration of [
    'TrainingNodeKind',
    'TrainingCheckpoint',
    'TrainingChoice',
    'TrainingOutcome',
    'TrainingNode',
    'TrainingGraph',
  ]) {
    assert.match(typeSpec, new RegExp(`(?:model|union) ${declaration}\\b`));
    assert.ok(authoredSchema.$defs[declaration], `missing authored JSON Schema declaration ${declaration}`);
  }
  assert.equal(authoredSchema.$schema, 'https://json-schema.org/draft/2020-12/schema');
});

test('training contract workflow pins the reviewed TJSV revision', () => {
  assert.match(workflow, /5bab34e08856c47af3600adf40a4aa860fa71c01/);
  assert.match(workflow, /typespec-json-schema-validator\.mjs check/);
  assert.match(workflow, /training-graph\.parity\.json/);
});
