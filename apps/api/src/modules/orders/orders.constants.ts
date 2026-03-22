// Phase 1 marketplace economics and reveal policy come directly from HLD 07/11.
// All values are configurable via environment variables with sensible defaults.
export const platformFeeInr         = Number(process.env.PLATFORM_FEE_INR          ?? 10);
export const commissionRate         = Number(process.env.COMMISSION_RATE            ?? 0.12);
export const highValueThresholdInr  = Number(process.env.HIGH_VALUE_THRESHOLD_INR   ?? 2000);
export const highValueWindowHours   = Number(process.env.HIGH_VALUE_WINDOW_HOURS    ?? 4);
