# ─── Production environment ────────────────────────────────────────────────────
# ALL secrets via TF_VAR_* — never committed.
#
#   export TF_VAR_db_password=<strong-password>
#   export TF_VAR_redis_password=<strong-password>
#   export TF_VAR_code_encryption_key=<64-char-hex>
#   export TF_VAR_admin_api_token=<strong-token>
#   export TF_VAR_razorpay_key_id=<rzp_live_...>
#   export TF_VAR_razorpay_key_secret=<secret>
#   export TF_VAR_razorpay_webhook_secret=<webhook-secret>
#   export TF_VAR_exotel_account_sid=<sid>
#   export TF_VAR_exotel_app_id=<app-id>
#   export TF_VAR_exotel_app_secret=<secret>

environment = "production"
aws_region  = "ap-south-1"

# PostgreSQL: micro_2_0 (upgrade to small_2_0 if needed)
postgres_bundle_id = "micro_2_0"
db_name            = "couponbazaar"
db_user            = "cbuser"

# Redis: nano_2_0 — sufficient for Phase 1
redis_bundle_id = "nano_2_0"

# Container: micro for production headroom (~$10/mo)
container_power = "micro"
container_scale = 1

# Live providers
payment_provider = "RAZORPAY"
otp_provider     = "EXOTEL"

# Tunables
otp_ttl_minutes         = 5
otp_max_attempts        = 5
session_ttl_hours       = 720
payment_timeout_minutes = 30

# Set this after each `aws lightsail push-container-image`
api_image_version = 1
