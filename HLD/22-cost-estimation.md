# 22 — Cost Estimation

## Phase 1: MVP (Month 1-3) — Two Options

### Option A: On-Premises

### One-Time Hardware Cost

| Item | Cost |
|------|------|
| Server 1 (App + Redis) | ₹40,000 |
| Server 2 (PostgreSQL) | ₹45,000 |
| Router/Firewall | ₹10,000 |
| UPS (1500VA) | ₹8,000 |
| Networking cables/switch | ₹2,000 |
| **Total Hardware** | **~₹1,05,000** |

> **No hardware budget?** Use a Hetzner dedicated server at ₹8,000/month instead — skip hardware cost entirely.

### Monthly Running Costs

| Item | Monthly Cost |
|------|-------------|
| Internet (100Mbps business line) | ₹3,000 |
| Electricity (~24×7 servers) | ₹2,000 |
| Backblaze B2 (backups) | ₹500 |
| Cloudflare (free tier) | ₹0 |
| Razorpay (2% of GMV) | Variable |
| MSG91 (SMS) | ₹500 |
| SendGrid / Firebase / Sentry | Free tier |
| Domain | ₹200 |
| Staging VPS (Hetzner CX21) | ₹800 |
| **Total Infra** | **~₹7,000/month** |

### Option B: AWS Cloud

| Item | Monthly Cost |
|------|-------------|
| AWS (EC2×2, RDS, Redis, S3) | ₹15,000 |
| Razorpay (2% of GMV) | Variable |
| MSG91 (SMS) | ₹500 |
| Firebase/SendGrid/Sentry | Free tier |
| Domain | ₹200 |
| **Total Infra** | **~₹17,000/month** |

---

One-time non-infra (both options): Legal ₹75K, Company reg ₹15K, Design ₹50K, App stores ₹10K = ₹1.5L

## Phase 2: Hybrid (Month 4-12)

Move app to cloud, keep DB on-prem:

| Item | Monthly Cost |
|------|-------------|
| Hetzner/AWS app servers | ₹12,000 |
| On-prem DB (electricity + net) | ₹5,000 |
| Backblaze B2 | ₹1,000 |
| Razorpay | ₹10-40K |
| SMS + KYC services | ₹5,000 |
| Analytics + Email | ₹2,000 |
| **Total** | **~₹35,000-65,000/month** |

## Phase 3: Full Cloud (Year 2)

Migrate fully to AWS Mumbai when on-prem can't scale:

| Item | Monthly Cost |
|------|-------------|
| AWS (RDS, ECS, ElastiCache, S3) | ₹1,50,000 |
| All services | ₹50,000 |
| **Total Infra** | **~₹2-3L/month** |

## Revenue vs Cost (revised)

| Month | GMV | Revenue (12%) | Cost | Net |
|-------|-----|--------------|------|-----|
| 3 | ₹1L | ₹12K | ₹7K | +₹5K |
| 6 | ₹5L | ₹60K | ₹35K | +₹25K |
| 9 | ₹20L | ₹2.4L | ₹65K | +₹1.75L |
| 12 | ₹50L | ₹6L | ₹2L | +₹4L |

**Break-even: Month 1-2 (infra only) — much earlier than cloud**

## Budget Comparison

| Approach | Monthly Infra | Break-even |
|----------|--------------|-----------|
| AWS (original) | ₹17,000 | Month 6 |
| On-Premises | ₹7,000 | Month 2 |
| Hetzner Dedicated (no hardware) | ₹10,000 | Month 3 |

## Total MVP Budget (On-Prem): ₹4-4.5 Lakhs
(₹1L hardware + ₹1.5L legal/setup + ₹2L development)
