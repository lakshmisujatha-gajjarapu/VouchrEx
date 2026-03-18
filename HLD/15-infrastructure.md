# 15 — Infrastructure & Deployment

## Deployment Options

Two valid paths for Phase 1 — pick based on budget and preference:

| | On-Premises | AWS Cloud |
|-|-------------|-----------|
| Upfront cost | ~₹1L (hardware) | ₹0 |
| Monthly infra | ~₹7,000 | ~₹17,000 |
| Break-even | Month 2 | Month 6 |
| Control | Full | Managed |
| Scalability | Manual | Auto-scale |
| Maintenance | You manage hardware | AWS manages it |
| Best for | Cost-conscious, have physical space | Fast start, no hardware hassle |

**Recommended start: On-Premises** — lower burn while validating the product. Migrate to cloud when traffic justifies it.

---

## Phase 1 Option A: On-Premises (MVP)

Run everything on your own hardware to minimize monthly burn. Migrate to cloud when traffic demands it.

### Hardware Setup (Minimum)

| Machine | Spec | Role | Cost (one-time) |
|---------|------|------|----------------|
| Server 1 | 16GB RAM, 8-core, 500GB SSD | App server + Redis | ₹40,000 |
| Server 2 | 16GB RAM, 8-core, 1TB SSD | PostgreSQL primary | ₹45,000 |
| Router/Firewall | pfSense or Mikrotik | Network security | ₹10,000 |
| UPS | 1500VA | Power backup | ₹8,000 |
| **Total Hardware** | | | **~₹1,00,000** |

> Alternatively: rent a dedicated server from **Hetzner / CtrlS Hyderabad / Serverius** at ₹6,000-10,000/month — no upfront hardware cost, easier to start.

### Software Stack (all open-source / free)

| Layer | Tool |
|-------|------|
| OS | Ubuntu 22.04 LTS |
| Containers | Docker + Docker Compose |
| App Server | NestJS (TypeScript) |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Reverse Proxy | Nginx (SSL termination, rate limiting) |
| Search | Meilisearch (self-hosted) |
| File Storage | MinIO (S3-compatible, self-hosted) |
| Secret Management | `.env` files → HashiCorp Vault (Phase 2) |
| Monitoring | Prometheus + Grafana (self-hosted) |
| Error Tracking | Sentry (free cloud tier) |
| CI/CD | GitHub Actions → SSH deploy |

### Networking

```
Internet → Cloudflare (free CDN + DDoS + SSL) → Your IP
           → Nginx (port 443, Let's Encrypt cert)
           → NestJS App (port 3000, internal only)
           → PostgreSQL (127.0.0.1 only, never exposed)
           → Redis (127.0.0.1 only)
           → MinIO (internal, port 9000)
```

- **Cloudflare free tier** — hides your real IP, CDN, basic WAF, SSL cert
- Nginx handles rate limiting before traffic reaches the app
- DB and Redis bound to localhost — not reachable externally

### Storage

**MinIO** replaces AWS S3 — stores KYC docs, dispute evidence, static assets. S3-compatible API so your code migrates to real S3 later with zero changes.

### Backup Strategy

| What | How | Frequency |
|------|-----|-----------|
| PostgreSQL | `pg_dump` → encrypted → Backblaze B2 | Daily |
| MinIO files | `rclone` sync → Backblaze B2 (~₹500/month for 1TB) | Daily |
| Redis | RDB snapshot to disk | Hourly |

### Security (on-prem equivalents)

| AWS Service | On-Prem Equivalent |
|-------------|-------------------|
| AWS KMS | `libsodium` / Node.js `crypto` with keys in env |
| AWS WAF | Nginx rate limiting + Cloudflare WAF (free) |
| AWS Secrets Manager | `.env` + restricted file permissions |
| GuardDuty | Fail2ban + UFW firewall rules |

### CI/CD

```
Push to main → GitHub Actions
  → Lint + Test
  → SSH into server
  → git pull → docker compose up --build -d
  → Health check → Telegram/Slack notification
```

### Environments

| Env | Where | Cost |
|-----|-------|------|
| Development | Local Docker Compose | Free |
| Staging | Hetzner VPS (CX21) | ~₹800/month |
| Production | On-prem server | Hardware one-time |

---

## Phase 1 Option B: AWS Cloud (MVP)

If you don't want to manage hardware or need to start faster.

### Compute
- EC2 t3.medium × 2 behind ALB

### Data
- PostgreSQL: RDS t3.micro (Phase 1)
- Redis: ElastiCache t3.micro
- S3: Evidence, KYC docs, static assets (encrypted)

### Networking
- CloudFront (CDN)
- ALB (SSL termination, health checks)
- VPC (public subnet: ALB, private subnet: app + DB)

### Security
- AWS KMS (voucher code encryption keys)
- AWS WAF (rate limiting, SQL injection protection)
- AWS Secrets Manager (API keys, DB credentials)
- IAM Roles (least privilege)
- GuardDuty (threat detection)

### Monitoring
- CloudWatch (metrics, logs, alarms)
- Sentry (error tracking)
- Grafana (dashboards, Phase 2)

### CI/CD
```
Push → GitHub Actions → Lint → Test → Security Scan → Build → Deploy to ECS
Staging: Auto-deploy on merge to develop
Production: Manual approval, blue-green deployment, auto-rollback
```

---

## Phase 2: Hybrid (10K+ users)

- App servers → Hetzner Cloud or AWS EC2 (auto-scale)
- PostgreSQL → keep on-prem with read replica, or migrate to RDS
- Redis → keep on-prem or move to ElastiCache
- MinIO → migrate to AWS S3

## Phase 3: Full Cloud (100K+ users)

Full migration to AWS Mumbai (`ap-south-1`) — ECS Fargate, RDS, ElastiCache, S3, CloudFront.
