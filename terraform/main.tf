locals {
  name_prefix = "couponbazaar-${var.environment}"
}

# ─── PostgreSQL 16 + PgBouncer on Lightsail ────────────────────────────────────

module "postgres_instance" {
  source = "./modules/postgres_instance"

  name        = "${local.name_prefix}-postgres"
  aws_region  = var.aws_region
  bundle_id   = var.postgres_bundle_id
  db_name     = var.db_name
  db_user     = var.db_user
  db_password = var.db_password
}

# ─── Redis on Lightsail ────────────────────────────────────────────────────────
# Phase 2: uncomment when Redis (queues/sessions) is needed.

# module "redis_instance" {
#   source = "./modules/redis_instance"
#
#   name           = "${local.name_prefix}-redis"
#   aws_region     = var.aws_region
#   bundle_id      = var.redis_bundle_id
#   redis_password = var.redis_password
# }

# ─── Lightsail Object Storage ──────────────────────────────────────────────────
# Phase 2: uncomment when file uploads are needed.

# module "storage" {
#   source = "./modules/storage"
#
#   bucket_name = "${local.name_prefix}-store"
#   aws_region  = var.aws_region
# }

# ─── NestJS API Container Service ─────────────────────────────────────────────

module "container_service" {
  source = "./modules/container_service"

  service_name  = "${local.name_prefix}-api"
  aws_region    = var.aws_region
  power         = var.container_power
  scale         = var.container_scale
  image_version = var.api_image_version

  environment_vars = {
    PORT     = "3010"
    NODE_ENV = var.environment == "production" ? "production" : "development"

    # Database — pooler URL for Prisma + PgBouncer (transaction mode)
    DATABASE_URL = module.postgres_instance.db_pooler_url

    # Phase 2: uncomment when Redis module is enabled
    # REDIS_URL = "redis://:${var.redis_password}@${module.redis_instance.private_ip}:6379"

    # Object storage (S3-compatible Lightsail bucket)
    # Phase 2: uncomment when storage module is enabled
    # MINIO_ENDPOINT   = module.storage.bucket_url
    # MINIO_ACCESS_KEY = module.storage.access_key_id
    # MINIO_SECRET_KEY = module.storage.secret_access_key
    # MINIO_BUCKET     = module.storage.bucket_name

    # App secrets
    CODE_ENCRYPTION_KEY = var.code_encryption_key
    ADMIN_API_TOKEN     = var.admin_api_token

    # Payment / OTP
    PAYMENT_PROVIDER        = var.payment_provider
    RAZORPAY_KEY_ID         = var.razorpay_key_id
    RAZORPAY_KEY_SECRET     = var.razorpay_key_secret
    RAZORPAY_WEBHOOK_SECRET = var.razorpay_webhook_secret
    OTP_PROVIDER            = var.otp_provider
    OTP_FIXED_CODE          = var.otp_fixed_code
    EXOTEL_ACCOUNT_SID      = var.exotel_account_sid
    EXOTEL_APP_ID           = var.exotel_app_id
    EXOTEL_APP_SECRET       = var.exotel_app_secret

    # Tunables
    OTP_TTL_MINUTES         = tostring(var.otp_ttl_minutes)
    OTP_MAX_ATTEMPTS        = tostring(var.otp_max_attempts)
    SESSION_TTL_HOURS       = tostring(var.session_ttl_hours)
    PAYMENT_TIMEOUT_MINUTES = tostring(var.payment_timeout_minutes)
  }
}

# ─── Database Migrations ───────────────────────────────────────────────────────
# Runs `prisma migrate deploy` after infra is up.
# Uses the DIRECT DB URL (not pooler) — required by Prisma migrate.
# Trigger: db_url changes or api_image_version bumps.

resource "null_resource" "run_migrations" {
  triggers = {
    db_url            = module.postgres_instance.db_url
    api_image_version = var.api_image_version
  }

  provisioner "local-exec" {
    command = <<-EOT
      cd ${path.root}/..
      DATABASE_URL="${module.postgres_instance.db_url}" \
        yarn workspace @cb/api prisma:migrate:deploy
    EOT
  }

  depends_on = [module.postgres_instance, module.container_service]
}
