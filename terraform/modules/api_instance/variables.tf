variable "name" {
  description = "Lightsail instance name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "bundle_id" {
  description = "Lightsail instance bundle — small_2_0 = 2 vCPU, 2 GB RAM, 60 GB SSD (~$12/mo)"
  type        = string
  default     = "small_2_0"
}

variable "environment" {
  description = "Deployment environment (staging | production)"
  type        = string
}

variable "dockerhub_username" {
  description = "Docker Hub username — image pulled as username/vouchrex-api:env-latest"
  type        = string
}

variable "ssh_public_key" {
  description = "SSH public key for the deploy user. Generate with: ssh-keygen -t ed25519 -C deploy"
  type        = string
}

variable "environment_vars" {
  description = "Environment variables written to /opt/vouchrex/.env on first boot"
  type        = map(string)
  sensitive   = true
}
