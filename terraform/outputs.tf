output "api_public_ip" {
  description = "Static IP of the API VPS — create an A record in Cloudflare pointing here"
  value       = module.api_instance.public_ip
}

output "api_ssh_target" {
  description = "SSH connection string for manual access"
  value       = "ssh ec2-user@${module.api_instance.public_ip}"
}

output "health_check_url" {
  description = "Direct health-check URL (bypasses Cloudflare, useful during provisioning)"
  value       = "http://${module.api_instance.public_ip}/health"
}

output "db_connection" {
  description = "Direct PostgreSQL URL (for migrations / Prisma Studio)"
  value       = module.postgres_instance.db_url
  sensitive   = true
}

output "postgres_private_ip" {
  description = "Private IP of the PostgreSQL Lightsail instance"
  value       = module.postgres_instance.private_ip
}

# Phase 2: uncomment when Redis module is enabled
# output "redis_private_ip" {
#   description = "Private IP of the Redis Lightsail instance"
#   value       = module.redis_instance.private_ip
# }

# Phase 2: uncomment when storage module is enabled
# output "bucket_name" {
#   description = "Lightsail bucket name"
#   value       = module.storage.bucket_name
# }
