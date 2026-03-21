output "private_ip" {
  description = "Private IP of the PostgreSQL instance"
  value       = aws_lightsail_instance.postgres.private_ip_address
}

output "public_ip" {
  description = "Static public IP of the PostgreSQL instance"
  value       = aws_lightsail_static_ip.postgres.ip_address
}

output "instance_name" {
  description = "Lightsail instance name"
  value       = aws_lightsail_instance.postgres.name
}

# Direct URL — used by `prisma migrate deploy` and Prisma Studio (bypasses PgBouncer)
output "db_url" {
  description = "Direct PostgreSQL connection URL (for migrations)"
  value       = "postgresql://${var.db_user}:${var.db_password}@${aws_lightsail_instance.postgres.private_ip_address}:5432/${var.db_name}?schema=public"
  sensitive   = true
}

# Pooler URL — used by the running API (PgBouncer transaction mode)
output "db_pooler_url" {
  description = "PgBouncer transaction-mode URL (for the running API)"
  value       = "postgresql://${var.db_user}:${var.db_password}@${aws_lightsail_instance.postgres.private_ip_address}:6432/${var.db_name}?pgbouncer=true&connection_limit=1"
  sensitive   = true
}
