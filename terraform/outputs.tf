output "api_url" {
  description = "Public HTTPS URL of the NestJS API container service"
  value       = module.container_service.public_url
}

output "api_service_name" {
  description = "Lightsail container service name (needed for docker push)"
  value       = module.container_service.service_name
}

output "health_check_url" {
  description = "Health-check endpoint — curl this to verify the deployment"
  value       = "${module.container_service.public_url}/health"
}

output "swagger_url" {
  description = "Swagger UI URL"
  value       = "${module.container_service.public_url}/docs"
}

output "db_connection" {
  description = "Direct PostgreSQL URL (for migrations / Prisma Studio)"
  value       = module.postgres_instance.db_url
  sensitive   = true
}

# Phase 2: uncomment when storage module is enabled
# output "bucket_name" {
#   description = "Lightsail bucket name"
#   value       = module.storage.bucket_name
# }

output "postgres_private_ip" {
  description = "Private IP of the PostgreSQL Lightsail instance"
  value       = module.postgres_instance.private_ip
}

# Phase 2: uncomment when Redis module is enabled
# output "redis_private_ip" {
#   description = "Private IP of the Redis Lightsail instance"
#   value       = module.redis_instance.private_ip
# }
#
# output "redis_public_ip" {
#   description = "Public (static) IP of the Redis Lightsail instance"
#   value       = module.redis_instance.public_ip
# }
