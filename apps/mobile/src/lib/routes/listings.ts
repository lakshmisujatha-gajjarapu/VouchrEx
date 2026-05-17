export const LISTINGS = {
  LIST:             '/listings',              // GET
  CREATE:           '/listings',              // POST — same path, different method
  BY_ID:            (id: string) => `/listings/${id}`,
  SELLER_INVENTORY: '/listings/seller/inventory',
  DEAL_OF_DAY:      '/listings/deal-of-day',
} as const;
