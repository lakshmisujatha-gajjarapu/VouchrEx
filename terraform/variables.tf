# ─── AWS ─────────────────────────────────────────────────────────────────────

variable "aws_region" {
  description = "AWS region for all Lightsail resources"
  type        = string
  default     = "ap-south-1"
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

# ─── Environment ──────────────────────────────────────────────────────────────

variable "environment" {
  description = "Deployment environment name (staging | production)"
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be 'staging' or 'production'."
  }
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
  description = "AUTH password for the Redis instance"
  type        = string
  sensitive   = true
}

# ─── Payment / OTP providers ──────────────────────────────────────────────────

variable "payment_provider" {
  description = "Payment backend: MOCK | RAZORPAY"
  type        = string
  default     = "MOCK"
}

variable "otp_provider" {
  description = "OTP backend: DEV | EXOTEL"
  type        = string
  default     = "DEV"
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

# ─── Container service sizing ─────────────────────────────────────────────────

variable "container_power" {
  description = "Lightsail container power (nano | micro | small | medium | large | xlarge)"
  type        = string
  default     = "nano"
}

variable "container_scale" {
  description = "Number of container nodes"
  type        = number
  default     = 1
}

# ─── Image versioning ─────────────────────────────────────────────────────────

variable "api_image_version" {
  description = "Version number of the pushed container image (increment per deploy)"
  type        = number
  default     = 0
}

# ─── Redis instance sizing ────────────────────────────────────────────────────

variable "redis_bundle_id" {
  description = "Lightsail instance bundle for the Redis VPS"
  type        = string
  default     = "nano_2_0"
}
