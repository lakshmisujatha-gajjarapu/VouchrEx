/**
 * Default tier limits for the global ThrottlerModule. These are the fallback
 * values when the corresponding env vars are not set; per-route overrides
 * (`@Throttle(...)`) can tighten or relax individual endpoints.
 */
export const THROTTLE_SHORT_TTL_MS_DEFAULT = 1000;
export const THROTTLE_SHORT_LIMIT_DEFAULT = 10;
export const THROTTLE_MEDIUM_TTL_MS_DEFAULT = 60_000;
export const THROTTLE_MEDIUM_LIMIT_DEFAULT = 100;
export const THROTTLE_LONG_TTL_MS_DEFAULT = 900_000;
export const THROTTLE_LONG_LIMIT_DEFAULT = 500;
