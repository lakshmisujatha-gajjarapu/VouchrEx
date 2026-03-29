# ─── Staging environment ───────────────────────────────────────────────────────
# Secrets live in secrets.staging.tfvars (gitignored).
# Deploy command:
#   terraform apply -var-file="environments/staging.tfvars" \
#                   -var-file="environments/secrets.staging.tfvars"

environment = "staging"
aws_region  = "ap-south-1"

# PostgreSQL: micro_2_0 (1 GB RAM, 40 GB SSD, ~$5/mo)
postgres_bundle_id = "micro_2_0"
db_name            = "vouchrex"
db_user            = "cbuser"

# Redis: nano_2_0 (~$3.50/mo)
redis_bundle_id = "nano_2_0"

# Container: nano (~$7/mo)
container_power = "nano"
container_scale = 1

# Mock providers — no real money or SMS in staging
payment_provider = "MOCK"
otp_provider     = "DEV"
otp_fixed_code   = "123456"

# Default tunables
otp_ttl_minutes         = 5
otp_max_attempts        = 5
session_ttl_hours       = 720
payment_timeout_minutes = 30

# No image deployed yet — bump after first `aws lightsail push-container-image`
api_image_version = 0
