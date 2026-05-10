/**
 * Socket.IO event names — mirrors apps/api/src/modules/realtime/realtime.constants.ts.
 * Keep these in sync with the API definitions.
 */
export const SOCKET_EVENTS = {
  ORDER_UPDATED: 'order:updated',
  DISPUTE_OPENED: 'dispute:opened',
} as const;

export const SOCKET_RECONNECTION_DELAY_MS = 1000;
export const SOCKET_RECONNECTION_DELAY_MAX_MS = 8000;
export const TAB_FLASH_INTERVAL_MS = 1000;
export const TAB_FLASH_PREFIX = '🔔 ';
