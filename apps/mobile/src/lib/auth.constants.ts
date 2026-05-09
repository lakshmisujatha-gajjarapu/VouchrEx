/**
 * Auth-related constants for the mobile client. Mirrors server-side bounds so
 * the device fingerprint we send is never rejected by the API.
 */

/** Refresh the access token this many ms before it expires. */
export const REFRESH_BEFORE_EXPIRY_MS = 2 * 60 * 1000;

/** Max length of the device-fingerprint string sent to the server. */
export const DEVICE_FINGERPRINT_MAX_LENGTH = 128;
