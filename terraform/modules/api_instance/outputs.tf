output "public_ip" {
  description = "Static public IP — point your Cloudflare A record here"
  value       = aws_lightsail_static_ip.api.ip_address
}

output "private_ip" {
  description = "Private IP for internal Lightsail network (same as Postgres VPC)"
  value       = aws_lightsail_instance.api.private_ip_address
}

output "instance_name" {
  description = "Lightsail instance name"
  value       = aws_lightsail_instance.api.name
}

output "ssh_user" {
  description = "SSH username for deploy access"
  value       = "ec2-user"
}
