variable "name" {
  description = "Lightsail instance name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "bundle_id" {
  description = "Lightsail bundle ID (e.g. nano_2_0)"
  type        = string
  default     = "nano_2_0"
}

variable "redis_password" {
  description = "Redis AUTH password"
  type        = string
  sensitive   = true
}
