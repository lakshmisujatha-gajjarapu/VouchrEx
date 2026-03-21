output "public_url" {
  description = "Public HTTPS URL provisioned by Lightsail for the container service"
  # aws_lightsail_container_service.url is already a full URL (https://...)
  value = trimsuffix(aws_lightsail_container_service.api.url, "/")
}

output "service_name" {
  description = "Lightsail container service name (used in `aws lightsail push-container-image`)"
  value       = aws_lightsail_container_service.api.name
}

output "registry_login_server" {
  description = "Lightsail container registry endpoint used for `aws lightsail push-container-image`"
  value       = "amazonaws.com"
}
