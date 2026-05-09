/**
 * Shared time-arithmetic constants. Use these instead of inline `60 * 60 * 1000`
 * patterns so units are explicit at the call site and there's a single place to
 * audit/adjust if behaviour ever changes.
 */
export const ONE_SECOND_MS = 1000;
export const ONE_MINUTE_MS = 60 * ONE_SECOND_MS;
export const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
export const ONE_DAY_MS = 24 * ONE_HOUR_MS;
export const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;
