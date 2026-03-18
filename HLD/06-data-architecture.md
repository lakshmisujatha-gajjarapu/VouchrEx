# 06 — Data Architecture

## Core Tables

### users
user_id (PK), phone, name, aadhaar_hash (unique), kyc_status, kyc_level, trust_score, tier, bank_account_encrypted, razorpay_linked_account_id, device_id, status, created_at

### brands
brand_id (PK), name, logo_url, category, code_format_regex, auto_verify_enabled, verify_api_endpoint, avg_discount_percent, verification_window_hours, active

### voucher_listings
listing_id (PK), seller_id (FK→users), brand_id (FK→brands), voucher_type, face_value, selling_price, discount_percent, status, verification_status, expiry_date, proof_url, is_guaranteed, buyer_id, sold_at, created_at

### code_vault
vault_id (PK), listing_id (FK, unique), encrypted_code, encryption_key_ref, code_hash (unique), view_count, first_viewed_at, last_viewed_at

### orders
order_id (PK), listing_id, buyer_id, seller_id, amount, platform_fee, commission, seller_payout, status, code_revealed_at, verification_deadline, confirmed_at, created_at

### payments
payment_id (PK), order_id, razorpay_payment_id, amount, method, status, escrow_status, payout_status, payout_completed_at, refund_status

### disputes
dispute_id (PK), order_id, raised_by, reason, description, evidence_urls[], seller_response, auto_check_result, resolution, resolved_by, status, created_at

### trust_events
event_id (PK), user_id, event_type, score_before, score_change, score_after, reason, reference_id

### device_registry
device_id (PK), user_id, platform, os_version, is_rooted, is_emulator, fcm_token, last_ip, status

### fraud_signals
signal_id (PK), user_id, signal_type, severity, details (JSONB), auto_action_taken, reviewed

### audit_log
log_id (PK), entity_type, entity_id, action, actor_id, old_state, new_state, metadata (JSONB), ip_address, device_id, created_at (APPEND-ONLY)

## Storage Strategy

| Data | Storage | Why |
|------|---------|-----|
| Core entities | PostgreSQL | ACID, relational |
| Voucher codes | PostgreSQL + KMS | Encrypted, separate keys |
| Sessions, OTPs, timers | Redis | TTL, in-memory |
| Search index | Meilisearch/ES | Full-text, filters |
| Evidence, KYC docs | S3 | Blob storage |
| Audit logs | PostgreSQL | Append-only, queryable |
| Trust scores (hot) | Redis cache | Fast lookups |