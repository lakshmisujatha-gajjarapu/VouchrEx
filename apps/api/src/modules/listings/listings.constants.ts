/**
 * Listings module defaults. All values are configurable via env; the named
 * constants here are the single source of truth for fallbacks.
 */
export const LISTING_MIN_EXPIRY_HOURS_DEFAULT = 48;
export const SELLER_MAX_LISTINGS_PER_HOUR_DEFAULT = 5;
export const LISTINGS_PAGE_SIZE_DEFAULT = 20;

/**
 * Phase 1 platform-wide cap on voucher faceValue (INR). Tier-based caps in
 * HLD/07 are clamped to this value until the Phase 2 doc-submission verification
 * flow unlocks higher per-seller ceilings. sellingPrice is implicitly bounded
 * because it must be strictly less than faceValue.
 */
export const LISTING_MAX_PRICE_INR = 1000;
