/**
 * User trust tier values. Stored as `String` in Prisma rather than an enum so
 * the tier ladder can be re-tuned without a schema migration. Use this map
 * (rather than string literals) so renames surface as type errors.
 */
export const USER_TIERS = {
  BRONZE: 'BRONZE'
} as const;

export type UserTier = (typeof USER_TIERS)[keyof typeof USER_TIERS];
