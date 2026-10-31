import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateDesiredRule, decideChange } from '../scripts/cloudflare-header-rule.mjs';

const rule = validateDesiredRule(JSON.parse(readFileSync(
  new URL('../infra/cloudflare/canonical-plus-security-headers.rule.json', import.meta.url), 'utf8',
)));

test('Cloudflare header change is strictly limited to canonical.plus', () => {
  assert.equal(rule.expression, '(http.host eq "canonical.plus")');
  assert.equal(rule.action, 'rewrite');
  assert.equal(Object.keys(rule.action_parameters.headers).length, 7);
  assert.throws(() => validateDesiredRule({ ...rule, expression: '(http.host contains "canonical")' }), /refusing/);
  assert.throws(() => validateDesiredRule({ ...rule, action: 'redirect' }), /refusing/);
});

test('single-rule updates retain other rules and fail closed on conflicts', () => {
  assert.equal(decideChange([], rule).kind, 'post');
  assert.equal(decideChange([{ ...rule, id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }], rule).kind, 'noop');
  assert.deepEqual(
    decideChange([{ ...rule, id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', enabled: false }], rule),
    { kind: 'patch', ruleId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  );
  assert.throws(() => decideChange([{ ...rule, id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }, { ...rule, id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' }], rule), /duplicate/);
  assert.throws(() => decideChange([{ ...rule, expression: 'true', id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }], rule), /unexpected host/);
  assert.throws(() => decideChange([{
    ref: 'different',
    action: 'rewrite',
    action_parameters: { headers: { 'Content-Security-Policy': { operation: 'set', value: "default-src 'self'" } } },
  }], rule), /competing/);
  assert.throws(() => decideChange([
    { ...rule, id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    {
      ref: 'legacy-security-rule',
      action: 'rewrite',
      action_parameters: { headers: { 'content-security-policy': { operation: 'set', value: 'default-src *' } } },
    },
  ], rule), /competing/);
  assert.throws(() => decideChange([{ ...rule, id: 'not-an-id!' }], rule), /valid id/);
});
