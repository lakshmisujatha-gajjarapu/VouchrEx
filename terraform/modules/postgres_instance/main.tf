locals {
  # cloud-init script:
  #   1. Install PostgreSQL 16 + PgBouncer via dnf
  #   2. Initialise the cluster, create app DB + user
  #   3. Configure PgBouncer in transaction mode on port 6432
  #   4. Harden pg_hba: only local + private-network connections allowed
  user_data = <<-EOT
    #!/bin/bash
    set -euo pipefail

    # ── 1. Install ──────────────────────────────────────────────────────────────
    dnf install -y postgresql16-server postgresql16 pgbouncer

    # ── 2. Initialise PostgreSQL cluster ────────────────────────────────────────
    postgresql-setup --initdb

    systemctl enable postgresql
    systemctl start postgresql

    # Create app database and user
    sudo -u postgres psql <<SQL
      CREATE USER ${var.db_user} WITH PASSWORD '${var.db_password}';
      CREATE DATABASE ${var.db_name} OWNER ${var.db_user};
      GRANT ALL PRIVILEGES ON DATABASE ${var.db_name} TO ${var.db_user};
    SQL

    # ── 3. PostgreSQL config ────────────────────────────────────────────────────
    PG_CONF=$(sudo -u postgres psql -t -c "SHOW config_file;" | xargs)
    PG_HBA=$(sudo -u postgres psql -t -c "SHOW hba_file;" | xargs)
    PG_DATA=$(dirname "$PG_CONF")

    # Listen on all interfaces (firewall restricts actual access)
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF"

    # Accept connections from private Lightsail CIDR and localhost only
    cat > "$PG_HBA" <<HBA
    # TYPE  DATABASE        USER            ADDRESS                 METHOD
    local   all             all                                     peer
    host    all             all             127.0.0.1/32            scram-sha-256
    host    all             all             ::1/128                 scram-sha-256
    host    all             all             172.26.0.0/15           scram-sha-256
    HBA

    systemctl restart postgresql

    # ── 4. PgBouncer config ─────────────────────────────────────────────────────
    cat > /etc/pgbouncer/pgbouncer.ini <<PGBOUNCER
    [databases]
    ${var.db_name} = host=127.0.0.1 port=5432 dbname=${var.db_name}

    [pgbouncer]
    listen_addr = 0.0.0.0
    listen_port = 6432
    auth_type   = scram-sha-256
    auth_file   = /etc/pgbouncer/userlist.txt
    pool_mode   = transaction
    max_client_conn = 100
    default_pool_size = 20
    reserve_pool_size = 5
    reserve_pool_timeout = 3
    server_reset_query = DISCARD ALL
    log_connections = 0
    log_disconnections = 0
    PGBOUNCER

    # PgBouncer userlist: MD5 or scram password for the app user
    PG_PWD_HASH=$(sudo -u postgres psql -t -c \
      "SELECT concat('\"', rolname, '\" \"', passwd, '\"') FROM pg_authid WHERE rolname='${var.db_user}';" \
      | xargs)
    echo "$PG_PWD_HASH" > /etc/pgbouncer/userlist.txt

    systemctl enable pgbouncer
    systemctl restart pgbouncer
  EOT
}

resource "aws_lightsail_instance" "postgres" {
  name              = var.name
  availability_zone = "${var.aws_region}a"
  blueprint_id      = "amazon_linux_2023"
  bundle_id         = var.bundle_id
  user_data         = local.user_data

  tags = {
    Project = "vouchrex"
    Role    = "postgres"
  }
}

resource "aws_lightsail_static_ip" "postgres" {
  name = "${var.name}-ip"
}

resource "aws_lightsail_static_ip_attachment" "postgres" {
  static_ip_name = aws_lightsail_static_ip.postgres.name
  instance_name  = aws_lightsail_instance.postgres.name
}

# Firewall: PostgreSQL (5432) and PgBouncer (6432) open to private CIDR only.
# SSH (22) open for emergency access — lock down to a bastion IP in production.
resource "aws_lightsail_instance_public_ports" "postgres" {
  instance_name = aws_lightsail_instance.postgres.name

  port_info {
    protocol  = "tcp"
    from_port = 5432
    to_port   = 5432
    cidrs     = ["172.26.0.0/15"]
  }

  port_info {
    protocol  = "tcp"
    from_port = 6432
    to_port   = 6432
    cidrs     = ["172.26.0.0/15"]
  }

  port_info {
    protocol  = "tcp"
    from_port = 22
    to_port   = 22
    cidrs     = ["0.0.0.0/0"]
  }
}
