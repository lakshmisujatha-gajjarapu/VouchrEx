resource "aws_lightsail_container_service" "api" {
  name        = var.service_name
  power       = var.power
  scale       = var.scale
  is_disabled = false

  tags = {
    Project = "couponbazaar"
    Role    = "api"
  }
}

# Deployment is a separate resource so we can re-deploy by bumping api_image_version
# without replacing the service (which would change the public URL).
#
# Image format: ":service-name.label.version"
# e.g. ":couponbazaar-staging-api.api.1"
resource "aws_lightsail_container_service_deployment_version" "api" {
  # Only create a deployment when a real image has been pushed (version > 0)
  count = var.image_version > 0 ? 1 : 0

  service_name = aws_lightsail_container_service.api.name

  container {
    container_name = "api"
    image          = ":${var.service_name}.api.${var.image_version}"

    environment = var.environment_vars

    ports = {
      "3010" = "HTTP"
    }
  }

  public_endpoint {
    container_name = "api"
    container_port = 3010

    health_check {
      healthy_threshold   = 2
      unhealthy_threshold = 2
      timeout_seconds     = 5
      interval_seconds    = 10
      path                = "/health"
      success_codes       = "200-299"
    }
  }
}
