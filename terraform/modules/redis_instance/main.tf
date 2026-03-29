# Amazon Linux 2023 blueprint — latest available on Lightsail
locals {
  # cloud-init user_data installs Redis 7, applies hardened config, enables AOF
  user_data = <<-EOT
    #!/bin/bash
    set -euo pipefail

    # Install Redis 7 from Amazon Linux extras / dnf
    dnf install -y redis7 --allowerasing 2>/dev/null || dnf install -y redis --allowerasing

    # Write hardened Redis config
    cat > /etc/redis/redis.conf <<'REDIS_CONF'
    bind 0.0.0.0
    protected-mode yes
    port 6379
    requirepass ${var.redis_password}
    appendonly yes
    appendfsync everysec
    maxmemory 200mb
    maxmemory-policy allkeys-lru
    loglevel notice
    logfile /var/log/redis/redis.log
    REDIS_CONF

    # Enable and start
    systemctl enable redis
    systemctl restart redis
  EOT
}

resource "aws_lightsail_instance" "redis" {
  name              = var.name
  availability_zone = "${var.aws_region}a"
  blueprint_id      = "amazon_linux_2023"
  bundle_id         = var.bundle_id
  user_data         = local.user_data

  tags = {
    Project = "vouchrex"
    Role    = "redis"
  }
}

resource "aws_lightsail_static_ip" "redis" {
  name = "${var.name}-ip"
}

resource "aws_lightsail_static_ip_attachment" "redis" {
  static_ip_name = aws_lightsail_static_ip.redis.name
  instance_name  = aws_lightsail_instance.redis.name
}

# Allow Redis only from within the Lightsail VPC (private IP access)
# Port 6379 opened to the VPC CIDR — not the public internet
resource "aws_lightsail_instance_public_ports" "redis" {
  instance_name = aws_lightsail_instance.redis.name

  port_info {
    protocol  = "tcp"
    from_port = 6379
    to_port   = 6379
    # Lightsail does not support VPC CIDR filtering directly;
    # restrict to the Lightsail private network range for ap-south-1
    cidrs = ["172.26.0.0/15"]
  }

  # Allow SSH for emergency access from any IP (lock this down in production)
  port_info {
    protocol  = "tcp"
    from_port = 22
    to_port   = 22
    cidrs     = ["0.0.0.0/0"]
  }
}
