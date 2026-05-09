/**
 * Push notification constants. The dedup TTL is intentionally short — it only
 * collapses double-fires from event ordering, not legitimate repeat events.
 */
export const PUSH_DEDUP_TTL_MS = 60_000;

/**
 * Expo push ticket error codes that signal the device token is permanently
 * invalid and should be deleted from our records.
 *
 * https://docs.expo.dev/push-notifications/sending-notifications/#individual-errors
 */
export const EXPO_DEAD_TOKEN_ERRORS = ['DeviceNotRegistered', 'InvalidCredentials'] as const;
export type ExpoDeadTokenError = (typeof EXPO_DEAD_TOKEN_ERRORS)[number];
