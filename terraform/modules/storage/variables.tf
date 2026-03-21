variable "bucket_name" {
  description = "Lightsail bucket name (must be globally unique, lowercase, hyphens only)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}
