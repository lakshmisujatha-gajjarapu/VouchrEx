variable "name" {
  description = "Lightsail instance name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "bundle_id" {
  description = "Lightsail bundle ID — micro_2_0 (1 GB RAM) recommended for PG 16"
  type        = string
  default     = "micro_2_0"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
}

variable "db_user" {
  description = "PostgreSQL application user"
  type        = string
}

variable "db_password" {
  description = "PostgreSQL application user password"
  type        = string
  sensitive   = true
}
