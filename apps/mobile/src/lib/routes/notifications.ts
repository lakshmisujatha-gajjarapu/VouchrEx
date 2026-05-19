export const NOTIFICATIONS = {
  LIST:       '/notifications',
  CLEAR_ALL:  '/notifications',
  READ_ALL:   '/notifications/read-all',
  BY_ID:      (id: string) => `/notifications/${id}`,
  BY_ID_READ: (id: string) => `/notifications/${id}/read`,
} as const;
