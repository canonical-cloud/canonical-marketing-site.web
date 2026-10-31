#!/usr/bin/env node
// Read-only by default. A production change requires a manual workflow, an
// environment approval, and a literal confirmation. Never PUT the ruleset.
import { readFileSync } from 'node:fs';

const RULE_PATH = new URL('../infra/cloudflare/canonical-plus-security-headers.rule.json', import.meta.url);
const REQUIRED_HEADERS = [
  'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy',
  'Cross-Origin-Opener-Policy', 'Permissions-Policy',
  'Content-Security-Policy', 'Strict-Transport-Security',
];

export const validateDesiredRule = (rule) => {
  if (rule?.ref !== 'canonical_plus_public_security_headers' ||
      rule?.expression !== '(http.host eq "canonical.plus")' ||
      rule?.action !== 'rewrite' ||
      !rule?.action_parameters?.headers ||
      Object.keys(rule.action_parameters.headers).length !== REQUIRED_HEADERS.length ||
      !REQUIRED_HEADERS.every((name) =>
        rule.action_parameters.headers[name]?.operation === 'set' &&
        typeof rule.action_parameters.headers[name]?.value === 'string' &&
        rule.action_parameters.headers[name].value.length > 0)) {
    throw new Error('refusing unexpected Cloudflare host scope or header rule');
  }
  if (rule.action_parameters.headers['Strict-Transport-Security'].value !== 'max-age=86400' ||
      !rule.action_parameters.headers['Content-Security-Policy'].value.includes("frame-ancestors 'none'")) {
    throw new Error('security headers deviate from the approved scoped rollout');
  }
  return rule;
};

const comparable = (rule) => JSON.stringify({
  ref: rule.ref,
  expression: rule.expression,
  action: rule.action,
  action_parameters: rule.action_parameters,
  enabled: rule.enabled !== false,
});

export const decideChange = (rules, desired) => {
  const matching = rules.filter((r) => r.ref === desired.ref);
  if (matching.length > 1) throw new Error('duplicate managed rule refs; manual reconciliation required');
  if (matching.length === 1) {
    if (matching[0].expression !== desired.expression) {
      throw new Error('existing managed rule has unexpected host matcher; manual review required');
    }
    return { kind: comparable(matching[0]) === comparable(desired) ? 'noop' : 'patch', ruleId: matching[0].id };
  }
  // Another rule can override our headers depending on ordering. Do not
  // automate changes when competing scopes are visible; inspect the entire
  // phase in the Cloudflare dashboard.
  if (rules.some((r) => r.action === 'rewrite' &&
      Object.keys(r.action_parameters?.headers || {}).some((k) => REQUIRED_HEADERS.includes(k)))) {
    throw new Error('potential competing response-header rule; manual reconciliation required');
  }
  return { kind: 'post' };
};

export const main = async () => {
  const mode = process.argv[2] || 'inspect';
  if (!['inspect', 'apply'].includes(mode)) throw new Error('mode must be inspect or apply');
  if (mode === 'apply' && process.env.CANONICAL_CF_CONFIRM !== 'APPLY_CANONICAL_PLUS_HEADERS') {
    throw new Error('missing exact manual production change confirmation');
  }
  const zoneId = process.env.CANONICAL_CF_ZONE_ID || '';
  const token = process.env.CANONICAL_CF_API_TOKEN || '';
  if (!/^[0-9a-f]{32}$/i.test(zoneId) || !token) {
    throw new Error('protected environment must supply Cloudflare zone id and scoped API token');
  }

  const desired = validateDesiredRule(JSON.parse(readFileSync(RULE_PATH, 'utf8')));
  const root = `https://api.cloudflare.com/client/v4/zones/${zoneId}`;
  const request = async (method, path, body) => {
    const response = await fetch(root + path, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      // Do not log raw service responses: they might contain sensitive metadata.
      throw new Error(`Cloudflare ${method} request failed: HTTP ${response.status}`);
    }
    return data.result;
  };

  const zone = await request('GET', '');
  if (zone?.name !== 'canonical.plus') throw new Error('zone identity mismatch; refusing operation');

  // Phase entrypoint must already exist: no blind ruleset creation or
  // replacement. Cloudflare's single-rule POST/PATCH preserves unrelated rules.
  const phase = '/rulesets/phases/http_response_headers_transform/entrypoint';
  const entry = await request('GET', phase);
  if (entry?.phase !== 'http_response_headers_transform' || !entry?.id || !Array.isArray(entry.rules)) {
    throw new Error('missing or malformed phase entrypoint; configure manually before running');
  }
  const decision = decideChange(entry.rules, desired);
  process.stdout.write(`Cloudflare header rule inspect: zone canonical.plus, action ${decision.kind}, existing rules ${entry.rules.length}\n`);

  if (mode === 'inspect') return;
  if (decision.kind === 'noop') {
    process.stdout.write('Already matches committed rule. No changes made.\n');
    return;
  }
  const endpoint = `/rulesets/${entry.id}/rules` + (decision.kind === 'patch' ? `/${decision.ruleId}` : '');
  await request(decision.kind === 'patch' ? 'PATCH' : 'POST', endpoint, desired);
  const verified = await request('GET', phase);
  const after = decideChange(verified.rules || [], desired);
  if (after.kind !== 'noop') throw new Error('post-change Cloudflare readback mismatch');
  process.stdout.write('Scoped header rule applied and read back. Validate actual deployed HTTPS response and run live Chromium smoke.\n');
};

if (process.argv[1]?.endsWith('/cloudflare-header-rule.mjs')) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
