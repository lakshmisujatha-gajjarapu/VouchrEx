const test = require('node:test');
const assert = require('node:assert/strict');

require('ts-node/register/transpile-only');

const {
  computeTier,
  STRIKE_TABLE,
  strikeRuleFor,
  INDEFINITE_HOLD_UNTIL
} = require('../src/modules/users/trust-tier.ts');

test('computeTier: 100 is GOLD', () => {
  assert.equal(computeTier(100), 'GOLD');
});

test('computeTier: 80 is GOLD (boundary)', () => {
  assert.equal(computeTier(80), 'GOLD');
});

test('computeTier: 79 is SILVER', () => {
  assert.equal(computeTier(79), 'SILVER');
});

test('computeTier: 50 is SILVER (boundary)', () => {
  assert.equal(computeTier(50), 'SILVER');
});

test('computeTier: 49 is BRONZE', () => {
  assert.equal(computeTier(49), 'BRONZE');
});

test('computeTier: 30 is BRONZE (boundary)', () => {
  assert.equal(computeTier(30), 'BRONZE');
});

test('computeTier: 29 is BLOCKED', () => {
  assert.equal(computeTier(29), 'BLOCKED');
});

test('computeTier: 0 is BLOCKED', () => {
  assert.equal(computeTier(0), 'BLOCKED');
});

test('STRIKE_TABLE strike 1: -15 score, 7-day hold', () => {
  assert.equal(STRIKE_TABLE[1].scoreDelta, 15);
  assert.equal(STRIKE_TABLE[1].holdDays, 7);
});

test('STRIKE_TABLE strike 2: -25 score, 14-day hold', () => {
  assert.equal(STRIKE_TABLE[2].scoreDelta, 25);
  assert.equal(STRIKE_TABLE[2].holdDays, 14);
});

test('STRIKE_TABLE strike 3: -40 score, indefinite hold', () => {
  assert.equal(STRIKE_TABLE[3].scoreDelta, 40);
  assert.equal(STRIKE_TABLE[3].holdDays, 'indefinite');
});

test('strikeRuleFor: strikes 1-3 return their own rule', () => {
  assert.equal(strikeRuleFor(1).scoreDelta, 15);
  assert.equal(strikeRuleFor(2).scoreDelta, 25);
  assert.equal(strikeRuleFor(3).scoreDelta, 40);
});

test('strikeRuleFor: strike 4+ clamps to strike-3 rule', () => {
  assert.equal(strikeRuleFor(4).scoreDelta, 40);
  assert.equal(strikeRuleFor(10).scoreDelta, 40);
  assert.equal(strikeRuleFor(4).holdDays, 'indefinite');
});

test('strikeRuleFor: strike 0 or negative clamps up to strike-1 rule', () => {
  assert.equal(strikeRuleFor(0).scoreDelta, 15);
  assert.equal(strikeRuleFor(-1).scoreDelta, 15);
});

test('INDEFINITE_HOLD_UNTIL is the exact sentinel 9999-12-31T23:59:59.000Z', () => {
  assert.ok(INDEFINITE_HOLD_UNTIL instanceof Date);
  assert.equal(INDEFINITE_HOLD_UNTIL.toISOString(), '9999-12-31T23:59:59.000Z');
});
