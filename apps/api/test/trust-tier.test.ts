import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeTier,
  STRIKE_TABLE,
  strikeRuleFor,
} from '../src/modules/users/trust-tier';

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

test('STRIKE_TABLE strike 1: -10 score, 3-day hold', () => {
  assert.equal(STRIKE_TABLE[1].scoreDelta, 10);
  assert.equal(STRIKE_TABLE[1].holdDays, 3);
});

test('STRIKE_TABLE strike 2: -20 score, 7-day hold', () => {
  assert.equal(STRIKE_TABLE[2].scoreDelta, 20);
  assert.equal(STRIKE_TABLE[2].holdDays, 7);
});

test('STRIKE_TABLE strike 3: -30 score, 14-day hold (finite)', () => {
  assert.equal(STRIKE_TABLE[3].scoreDelta, 30);
  assert.equal(STRIKE_TABLE[3].holdDays, 14);
});

test('strikeRuleFor: strikes 1-3 return their own rule', () => {
  assert.equal(strikeRuleFor(1).scoreDelta, 10);
  assert.equal(strikeRuleFor(2).scoreDelta, 20);
  assert.equal(strikeRuleFor(3).scoreDelta, 30);
});

test('strikeRuleFor: strike 4+ clamps to strike-3 rule', () => {
  assert.equal(strikeRuleFor(4).scoreDelta, 30);
  assert.equal(strikeRuleFor(10).scoreDelta, 30);
  assert.equal(strikeRuleFor(4).holdDays, 14);
});

test('strikeRuleFor: strike 0 or negative clamps up to strike-1 rule', () => {
  assert.equal(strikeRuleFor(0).scoreDelta, 10);
  assert.equal(strikeRuleFor(-1).scoreDelta, 10);
});
