/**
 * Listings module defaults. All values are configurable via env; the named
 * constants here are the single source of truth for fallbacks. The platform-wide
 * faceValue cap lives at runtime in AppConfig (`listing_max_price_inr`).
 */
export const LISTING_MIN_EXPIRY_HOURS_DEFAULT = 48;
export const SELLER_MAX_LISTINGS_PER_HOUR_DEFAULT = 5;
export const LISTINGS_PAGE_SIZE_DEFAULT = 20;
