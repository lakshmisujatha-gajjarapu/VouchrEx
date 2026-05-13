/**
 * Socket.IO event names and room conventions shared between the API gateway,
 * the mobile app, and the admin web. Keep the literal strings here as the
 * single source of truth — clients in other workspaces mirror these values.
 */
export const SOCKET_EVENTS = {
  NOTIFICATION_NEW: 'notification:new',
  ORDER_UPDATED: 'order:updated',
  LISTING_CREATED: 'listing:created',
  LISTING_UPDATED: 'listing:updated',
  DISPUTE_OPENED: 'dispute:opened',
  CONFIG_UPDATED: 'config:updated'
} as const;

export const SOCKET_ROOMS = {
  ADMIN: 'admin',
  USER_PREFIX: 'user:'
} as const;

export const userRoom = (userId: string) => `${SOCKET_ROOMS.USER_PREFIX}${userId}`;
