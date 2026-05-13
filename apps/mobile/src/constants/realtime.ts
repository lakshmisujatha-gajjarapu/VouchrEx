/**
 * Mirrors apps/api/src/modules/realtime/realtime.constants.ts so the mobile
 * client doesn't import across workspace boundaries. Keep these in sync with
 * the API definitions.
 */
export const SOCKET_EVENTS = {
  NOTIFICATION_NEW: 'notification:new',
  ORDER_UPDATED: 'order:updated',
  LISTING_CREATED: 'listing:created',
  LISTING_UPDATED: 'listing:updated',
  DISPUTE_OPENED: 'dispute:opened',
  CONFIG_UPDATED: 'config:updated'
} as const;

export const SOCKET_RECONNECTION_DELAY_MS = 1000;
export const SOCKET_RECONNECTION_DELAY_MAX_MS = 8000;
export const SOCKET_RECONNECTION_ATTEMPTS = 10;
