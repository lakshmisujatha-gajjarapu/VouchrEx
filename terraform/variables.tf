# ─── AWS ─────────────────────────────────────────────────────────────────────

variable "aws_region" {
  description = "AWS region for all Lightsail resources"
  type        = string
  default     = "ap-south-1"
}

# ─── Environment ──────────────────────────────────────────────────────────────

variable "environment" {
  description = "Deployment environment name (staging | production)"
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be 'staging' or 'production'."
  }
}

# ─── API VPS ──────────────────────────────────────────────────────────────────

variable "api_bundle_id" {
  description = "Lightsail bundle for the API VPS. small_2_0 = 2 vCPU, 2 GB, 60 GB SSD (~$12/mo)"
  type        = string
  default     = "small_2_0"
}

variable "dockerhub_username" {
  description = "Docker Hub username — images are pulled as username/couponbazaar-api:env-latest"
  type        = string
}

variable "api_ssh_public_key" {
  description = <<-EOT
    SSH public key for the deploy user on the API VPS.
    Generate once: ssh-keygen -t ed25519 -f ~/.ssh/couponbazaar_deploy -C deploy
    Store the private key as the SSH_PRIVATE_KEY GitHub secret.
    Store the public key here (contents of ~/.ssh/couponbazaar_deploy.pub).
  EOT
  type        = string
}

# ─── PostgreSQL ───────────────────────────────────────────────────────────────

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "couponbazaar"
}

variable "db_user" {
  description = "PostgreSQL application username"
  type        = string
  default     = "cbuser"
}

variable "db_password" {
  description = "PostgreSQL application user password"
  type        = string
  sensitive   = true
}

variable "postgres_bundle_id" {
  description = "Lightsail bundle ID for the PostgreSQL VPS (micro_2_0 = 1 GB RAM, ~$5/mo)"
  type        = string
  default     = "micro_2_0"
}

# ─── App secrets ──────────────────────────────────────────────────────────────

variable "code_encryption_key" {
  description = "AES-256 key for CodeVault encryption (hex, 64 chars)"
  type        = string
  sensitive   = true
}

variable "admin_api_token" {
  description = "Static token for x-admin-token protected endpoints"
  type        = string
  sensitive   = true
}

variable "redis_password" {
  description = "AUTH password for the Redis instance (Phase 2)"
  type        = string
  sensitive   = true
  default     = ""
}

# ─── Payment / OTP providers ──────────────────────────────────────────────────

variable "otp_provider" {
  description = "OTP backend: DEV | EXOTEL"
  type        = string
  default     = "DEV"
}

variable "auth_challenge_secret" {
  description = "Signing secret for OTP request challenges"
  type        = string
  sensitive   = true
  default     = ""
}

variable "razorpay_key_id" {
  description = "Razorpay key ID (leave empty for staging)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "razorpay_key_secret" {
  description = "Razorpay key secret (leave empty for staging)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "razorpay_webhook_secret" {
  description = "Razorpay webhook secret (leave empty for staging)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "exotel_account_sid" {
  description = "Exotel account SID (leave empty for staging)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "exotel_app_id" {
  description = "Exotel app ID (leave empty for staging)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "exotel_app_secret" {
  description = "Exotel app secret (leave empty for staging)"
  type        = string
  sensitive   = true
  default     = ""
}

# ─── App tunables ─────────────────────────────────────────────────────────────

variable "otp_fixed_code" {
  description = "Fixed OTP code used when otp_provider=DEV"
  type        = string
  default     = "123456"
}

variable "auth_challenge_ttl_seconds" {
  description = "Lifetime of a signed OTP request challenge"
  type        = number
  default     = 180
}

variable "auth_pow_difficulty" {
  description = "Leading-zero hex difficulty for the OTP proof-of-work challenge"
  type        = number
  default     = 5
}

variable "otp_ttl_minutes" {
  description = "OTP expiry in minutes"
  type        = number
  default     = 5
}

variable "otp_max_attempts" {
  description = "Maximum OTP verification attempts before lockout"
  type        = number
  default     = 5
}

variable "otp_resend_cooldown_seconds" {
  description = "Minimum delay before another OTP can be sent to the same phone"
  type        = number
  default     = 60
}

variable "otp_max_per_phone_hour" {
  description = "Maximum OTP sends to a single phone number per hour"
  type        = number
  default     = 3
}

variable "otp_max_per_device_hour" {
  description = "Maximum OTP sends from one device per hour"
  type        = number
  default     = 4
}

variable "otp_max_per_ip_hour" {
  description = "Maximum OTP sends from one IP per hour"
  type        = number
  default     = 8
}

variable "otp_max_distinct_phones_per_device_day" {
  description = "Maximum distinct phone numbers one device can request in a day"
  type        = number
  default     = 3
}

variable "otp_max_distinct_phones_per_ip_day" {
  description = "Maximum distinct phone numbers one IP can request in a day"
  type        = number
  default     = 6
}

variable "session_ttl_hours" {
  description = "Session token TTL in hours"
  type        = number
  default     = 720
}

variable "payment_timeout_minutes" {
  description = "Minutes before an unpaid order is cancelled"
  type        = number
  default     = 30
}

# ─── Redis instance sizing ────────────────────────────────────────────────────

variable "redis_bundle_id" {
  description = "Lightsail instance bundle for the Redis VPS (Phase 2)"
  type        = string
  default     = "nano_2_0"
}
