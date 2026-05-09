function resolveApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3010';
}

export const API_CONFIG = {
  BASE_URL: resolveApiBaseUrl(),
  TIMEOUT: 30000,
};

export const AUTH_CONFIG = {
  COOKIE_NAME: 'cb_admin_token',
  COOKIE_MAX_AGE: 60 * 60 * 24 * 7, // 7 days
};

export const ADMIN_HEADER = 'x-admin-token';

/**
 * Socket.IO event names — mirrors apps/api/src/modules/realtime/realtime.constants.ts.
 * Keep these in sync with the API definitions.
 */
export const SOCKET_EVENTS = {
  ORDER_UPDATED: 'order:updated',
  DISPUTE_OPENED: 'dispute:opened'
} as const;

export const SOCKET_RECONNECTION_DELAY_MS = 1000;
export const SOCKET_RECONNECTION_DELAY_MAX_MS = 8000;
export const TAB_FLASH_INTERVAL_MS = 1000;
export const TAB_FLASH_PREFIX = '🔔 ';
