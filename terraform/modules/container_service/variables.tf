variable "service_name" {
  description = "Lightsail container service name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "power" {
  description = "Container service power tier (nano | micro | small | medium | large | xlarge)"
  type        = string
  default     = "nano"
}

variable "scale" {
  description = "Number of container nodes"
  type        = number
  default     = 1
}

variable "image_version" {
  description = "Version number of the pushed container image (0 = no deployment yet)"
  type        = number
  default     = 0
}

variable "environment_vars" {
  description = "Environment variables to inject into the container"
  type        = map(string)
  sensitive   = true
}
