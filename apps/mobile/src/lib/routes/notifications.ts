export const NOTIFICATIONS = {
  LIST:       '/notifications',               // GET
  CLEAR_ALL:  '/notifications',               // DELETE — same path, different method
  READ_ALL:   '/notifications/read-all',
  BY_ID_READ: (id: string) => `/notifications/${id}/read`,
} as const;
