export type Tier = 'GOLD' | 'SILVER' | 'BRONZE' | 'BLOCKED';

export function computeTier(trustScore: number): Tier {
  if (trustScore >= 80) return 'GOLD';
  if (trustScore >= 50) return 'SILVER';
  if (trustScore >= 30) return 'BRONZE';
  return 'BLOCKED';
}

export interface StrikeRule {
  scoreDelta: number;
  holdDays: number;
}

export const STRIKE_TABLE: Record<1 | 2 | 3, StrikeRule> = {
  1: { scoreDelta: 10, holdDays: 3 },
  2: { scoreDelta: 20, holdDays: 7 },
  3: { scoreDelta: 30, holdDays: 14 }
};

export function strikeRuleFor(strikeCount: number): StrikeRule {
  const idx = Math.min(Math.max(strikeCount, 1), 3) as 1 | 2 | 3;
  return STRIKE_TABLE[idx];
}
