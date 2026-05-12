export type Tier = 'GOLD' | 'SILVER' | 'BRONZE' | 'BLOCKED';

export function computeTier(trustScore: number): Tier {
  if (trustScore >= 80) return 'GOLD';
  if (trustScore >= 50) return 'SILVER';
  if (trustScore >= 30) return 'BRONZE';
  return 'BLOCKED';
}

export interface StrikeRule {
  scoreDelta: number;
  holdDays: number | 'indefinite';
}

export const STRIKE_TABLE: Record<1 | 2 | 3, StrikeRule> = {
  1: { scoreDelta: 15, holdDays: 7 },
  2: { scoreDelta: 25, holdDays: 14 },
  3: { scoreDelta: 40, holdDays: 'indefinite' }
};

export function strikeRuleFor(strikeCount: number): StrikeRule {
  const idx = Math.min(Math.max(strikeCount, 1), 3) as 1 | 2 | 3;
  return STRIKE_TABLE[idx];
}

export const INDEFINITE_HOLD_UNTIL = new Date('9999-12-31T23:59:59.000Z');
