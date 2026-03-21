output "private_ip" {
  description = "Private IP of the Redis instance (use this in REDIS_URL for the API)"
  value       = aws_lightsail_instance.redis.private_ip_address
}

output "public_ip" {
  description = "Static public IP attached to the Redis instance"
  value       = aws_lightsail_static_ip.redis.ip_address
}

output "instance_name" {
  description = "Lightsail instance name"
  value       = aws_lightsail_instance.redis.name
}
