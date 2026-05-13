// Phase 1 marketplace economics and reveal policy come directly from HLD 07/11.
// Buyer fee + seller commission rates are managed at runtime via AppConfig
// (keys: `buyer_fee_rate`, `seller_commission_rate`). See AppConfigService.
//
// HIGH_VALUE_THRESHOLD_INR / HIGH_VALUE_WINDOW_HOURS deliberately remain env-only:
// they're fraud-control parameters that should not be tunable by every admin in
// the console — tightening them retroactively risks blocking pending orders, and
// loosening them widens fraud exposure. Promote to AppConfig only with an
// audit/approval workflow.
export const HIGH_VALUE_THRESHOLD_INR_DEFAULT = 2000;
export const HIGH_VALUE_WINDOW_HOURS_DEFAULT = 4;

export const highValueThresholdInr = Number(process.env.HIGH_VALUE_THRESHOLD_INR ?? HIGH_VALUE_THRESHOLD_INR_DEFAULT);
export const highValueWindowHours = Number(process.env.HIGH_VALUE_WINDOW_HOURS ?? HIGH_VALUE_WINDOW_HOURS_DEFAULT);

// Fraud / velocity limits — see HLD fraud rules B1, B5.
export const BUYER_MAX_ORDERS_PER_HOUR_DEFAULT = 3;

// Scheduler tunables.
export const PAYMENT_TIMEOUT_MINUTES_DEFAULT = 30;
export const DISPUTE_ADMIN_ALERT_HOURS_DEFAULT = 24;
export const STALE_PAYMENT_SYNC_MINUTES_DEFAULT = 1;
export const STUCK_REFUND_RECONCILE_MINUTES_DEFAULT = 2;
export const STUCK_PAYOUT_RECONCILE_MINUTES_DEFAULT = 5;

// Auto-refund retry cap — prevent permanent failures from looping forever.
export const MAX_AUTO_REFUND_RETRY_ATTEMPTS = 5;

// Verification deadline reminder windows (minutes before deadline).
// Each entry sends a push at ~minutesBefore; the worker fires every 2 minutes,
// so we widen the match window by ±3 minutes either side.
export const VERIFICATION_REMINDER_WINDOWS = [
  { minutesBefore: 60, eventType: 'code.reveal_reminder_60min', label: '1 hour' },
  { minutesBefore: 30, eventType: 'code.reveal_reminder_30min', label: '30 minutes' },
  { minutesBefore: 5, eventType: 'code.reveal_reminder_5min', label: '5 minutes' }
] as const;
export const VERIFICATION_REMINDER_MATCH_WINDOW_MINUTES = 3;

export { DEFAULT_CURRENCY } from '../../common/marketplace.constants';
