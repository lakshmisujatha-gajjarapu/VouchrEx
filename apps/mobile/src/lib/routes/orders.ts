export const ORDERS = {
  LIST:                '/orders',             // GET
  CREATE:              '/orders',             // POST — same path, different method
  BY_ID:               (id: string) => `/orders/${id}`,
  CHECKOUT:            (id: string) => `/orders/${id}/checkout`,
  PAYMENTS_VERIFY:     (id: string) => `/orders/${id}/payments/verify`,
  PAYMENTS_SYNC:       (id: string) => `/orders/${id}/payments/sync`,
  REVEAL:              (id: string) => `/orders/${id}/reveal`,
  CONFIRM:             (id: string) => `/orders/${id}/confirm`,
  DISPUTES:            (id: string) => `/orders/${id}/disputes`,
  DISPUTE_EVIDENCE:    (id: string) => `/orders/${id}/dispute-evidence`,
  DISPUTE_SELLER_RESPONSE: (id: string) => `/orders/disputes/${id}/seller-response`,
  DISPUTE_RESOLVE:     (id: string) => `/orders/disputes/${id}/resolve`,
} as const;
