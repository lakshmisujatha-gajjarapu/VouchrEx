locals {
  # Build KEY=value lines from the environment_vars map.
  # Note: values must not contain the sequence "${" — this is a standard
  # Terraform template limitation. Generated secrets (hex keys, API tokens)
  # never contain that sequence.
  env_file = join("\n", [for k, v in var.environment_vars : "${k}=${v}"])

  # Mutable image tag — CI pushes to this tag, deploy just pulls it.
  docker_image = "${var.dockerhub_username}/couponbazaar-api:${var.environment}-latest"

  # cloud-init: install Docker + nginx, write compose + env, start services.
  user_data = <<-EOT
    #!/bin/bash
    set -euo pipefail

    # ── 1. System update ────────────────────────────────────────────────────────
    dnf update -y

    # ── 2. Docker CE ────────────────────────────────────────────────────────────
    dnf install -y docker
    systemctl enable docker
    systemctl start docker

    # Docker Compose v2 plugin
    ARCH=$$(uname -m)
    mkdir -p /usr/local/lib/docker/cli-plugins
    curl -fsSL \
      "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$${ARCH}" \
      -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

    # ec2-user can run docker without sudo (needed for SSH-based deploys)
    usermod -aG docker ec2-user

    # ── 3. nginx ────────────────────────────────────────────────────────────────
    dnf install -y nginx
    systemctl enable nginx

    # Reverse proxy — listens on :80, forwards to NestJS on 127.0.0.1:3010.
    # Cloudflare terminates TLS; traffic from CF to here is HTTP (Flexible mode).
    # Pass real client IP from CF-Connecting-IP so NestJS throttler sees it.
    cat > /etc/nginx/conf.d/couponbazaar.conf <<'NGINXEOF'
    server {
        listen 80 default_server;
        server_name _;

        # Real client IP comes from Cloudflare — use CF-Connecting-IP
        real_ip_header    CF-Connecting-IP;
        set_real_ip_from  0.0.0.0/0;

        location / {
            proxy_pass          http://127.0.0.1:3010;
            proxy_http_version  1.1;

            # WebSocket support (Socket.IO)
            proxy_set_header    Upgrade    $http_upgrade;
            proxy_set_header    Connection "upgrade";

            proxy_set_header    Host              $host;
            proxy_set_header    X-Real-IP         $remote_addr;
            proxy_set_header    X-Forwarded-For   $proxy_add_x_forwarded_for;
            proxy_set_header    X-Forwarded-Proto $scheme;

            proxy_read_timeout  60s;
            proxy_send_timeout  60s;
        }
    }
    NGINXEOF

    rm -f /etc/nginx/conf.d/default.conf
    nginx -t && systemctl start nginx

    # ── 4. App directory ────────────────────────────────────────────────────────
    mkdir -p /opt/couponbazaar
    chown ec2-user:ec2-user /opt/couponbazaar

    # ── 5. docker-compose.yml ───────────────────────────────────────────────────
    # Image uses the mutable env-latest tag. CI pushes new images to this tag;
    # the deploy step does `docker compose pull && up -d`.
    cat > /opt/couponbazaar/docker-compose.yml <<'COMPOSEEOF'
    services:
      api:
        image: ${local.docker_image}
        restart: unless-stopped
        env_file: /opt/couponbazaar/.env
        ports:
          - "127.0.0.1:3010:3010"
        healthcheck:
          test:
            - CMD
            - node
            - -e
            - "require('http').get('http://localhost:3010/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
          interval: 30s
          timeout: 5s
          retries: 3
          start_period: 40s
    COMPOSEEOF

    chown ec2-user:ec2-user /opt/couponbazaar/docker-compose.yml

    # ── 6. .env file ────────────────────────────────────────────────────────────
    # Written at Terraform apply time — update secrets by re-running terraform apply.
    # Phase 2: migrate to AWS Secrets Manager / Parameter Store.
    cat > /opt/couponbazaar/.env <<ENVEOF
    ${local.env_file}
    ENVEOF

    chmod 600 /opt/couponbazaar/.env
    chown ec2-user:ec2-user /opt/couponbazaar/.env

    # ── 7. Pull image + start ───────────────────────────────────────────────────
    # Run as ec2-user so the deploy script (SSH) uses the same user.
    sudo -u ec2-user docker compose -f /opt/couponbazaar/docker-compose.yml pull  || true
    sudo -u ec2-user docker compose -f /opt/couponbazaar/docker-compose.yml up -d || true

    # ── 8. systemd unit — restart compose on reboot ─────────────────────────────
    cat > /etc/systemd/system/couponbazaar.service <<'UNITEOF'
    [Unit]
    Description=CouponBazaar API (Docker Compose)
    Requires=docker.service
    After=docker.service network-online.target

    [Service]
    User=ec2-user
    WorkingDirectory=/opt/couponbazaar
    ExecStart=/usr/bin/docker compose up
    ExecStop=/usr/bin/docker compose down
    Restart=on-failure
    RestartSec=10

    [Install]
    WantedBy=multi-user.target
    UNITEOF

    systemctl daemon-reload
    systemctl enable couponbazaar
  EOT
}

# ── SSH deploy key ──────────────────────────────────────────────────────────────
resource "aws_lightsail_key_pair" "deploy" {
  name       = "${var.name}-deploy"
  public_key = var.ssh_public_key
}

# ── API VPS ────────────────────────────────────────────────────────────────────
resource "aws_lightsail_instance" "api" {
  name              = var.name
  availability_zone = "${var.aws_region}a"
  blueprint_id      = "amazon_linux_2023"
  bundle_id         = var.bundle_id
  key_pair_name     = aws_lightsail_key_pair.deploy.name
  user_data         = local.user_data

  tags = {
    Project = "couponbazaar"
    Role    = "api"
    Env     = var.environment
  }
}

# ── Static IP ──────────────────────────────────────────────────────────────────
resource "aws_lightsail_static_ip" "api" {
  name = "${var.name}-ip"
}

resource "aws_lightsail_static_ip_attachment" "api" {
  static_ip_name = aws_lightsail_static_ip.api.name
  instance_name  = aws_lightsail_instance.api.name
}

# ── Firewall ───────────────────────────────────────────────────────────────────
# Port 80  — HTTP from all (Cloudflare proxies HTTPS → HTTP here)
# Port 443 — HTTPS from all (for direct SSL later; unused with CF Flexible mode)
# Port 22  — SSH from all (restrict to your office/bastion IP in production)
# Port 3010 is NOT opened — nginx proxy keeps it internal only
resource "aws_lightsail_instance_public_ports" "api" {
  instance_name = aws_lightsail_instance.api.name

  port_info {
    protocol  = "tcp"
    from_port = 80
    to_port   = 80
    cidrs     = ["0.0.0.0/0"]
  }

  port_info {
    protocol  = "tcp"
    from_port = 443
    to_port   = 443
    cidrs     = ["0.0.0.0/0"]
  }

  port_info {
    protocol  = "tcp"
    from_port = 22
    to_port   = 22
    cidrs     = ["0.0.0.0/0"] # TODO: lock to bastion/VPN IP in production
  }
}
