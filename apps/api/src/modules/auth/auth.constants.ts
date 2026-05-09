export const sessionHeaderName = 'x-session-token';
export const e164PhonePattern = /^\+[1-9]\d{9,14}$/u;

// Token generation: random byte length for access/refresh tokens.
// 32 bytes = 256 bits of entropy → 64-char hex string.
export const SESSION_TOKEN_BYTE_LENGTH = 32;

// OTP / session defaults — overridable via env, but the named constants serve
// as the single source of truth for fallback values.
export const OTP_MAX_ATTEMPTS_DEFAULT = 5;
export const ACCESS_TOKEN_TTL_MINUTES_DEFAULT = 15;
export const REFRESH_TOKEN_TTL_DAYS_DEFAULT = 90;
export const OTP_RESEND_COOLDOWN_SECONDS_DEFAULT = 60;
export const OTP_MAX_PER_PHONE_HOUR_DEFAULT = 3;
export const OTP_MAX_PER_DEVICE_HOUR_DEFAULT = 4;
export const OTP_MAX_DISTINCT_PHONES_PER_DEVICE_DAY_DEFAULT = 3;
export const OTP_TTL_MINUTES_DEFAULT = 5;
export const OTP_CHALLENGE_GRACE_HOURS_DEFAULT = 24;
export const AUDIT_RETENTION_DAYS_DEFAULT = 7;
export const OTP_FIXED_CODE_DEV = '123456';

// DTO bounds — kept here so server DTOs and the mobile client agree.
export const USER_NAME_MIN_LENGTH = 2;
export const USER_NAME_MAX_LENGTH = 80;
export const DEVICE_FINGERPRINT_MAX_LENGTH = 128;
export const OTP_CODE_MIN_LENGTH = 6;
// Upper bound is generous to fit the MSG91_WIDGET JWT access token, which is
// stored in the same field as the dev OTP digit-string.
export const OTP_CODE_MAX_LENGTH = 2048;

// Throttle decorators on the controller — tightened on OTP endpoints to deter
// brute force / SMS flooding.
export const REQUEST_OTP_THROTTLE_SHORT = { limit: 1, ttl: 10_000 } as const;
export const REQUEST_OTP_THROTTLE_MEDIUM = { limit: 5, ttl: 60_000 } as const;
export const VERIFY_OTP_THROTTLE_SHORT = { limit: 1, ttl: 2_000 } as const;
export const VERIFY_OTP_THROTTLE_MEDIUM = { limit: 5, ttl: 60_000 } as const;
