# 17 — Scalability Strategy

## Scaling Plan

| Phase | Users | Infra | Cost/Month |
|-------|-------|-------|-----------|
| 1 | 0-10K | 2× EC2, single RDS, single Redis | ₹30-50K |
| 2 | 10K-100K | ECS Fargate, RDS+replica, Redis cluster, ES | ₹1-2L |
| 3 | 100K-1M | Microservices, sharded DB, queues | ₹5-10L |
| 4 | 1M+ | Event-driven, Aurora multi-region, Kafka | ₹20-50L |

## Module Extraction Order (Monolith → Microservices)
1. Payment Service (compliance, independent scaling)
2. Fraud Detection Service (CPU-intensive)
3. Notification Service (async, bursty)
4. Search Service (read-heavy)
5. Remaining services

## Database Scaling
```
Phase 1: Single PostgreSQL
Phase 2: Primary + Read Replica + PgBouncer
Phase 3: Vertical scaling (larger instance)
Phase 4: Functional sharding (separate DBs)
Phase 5: Aurora Serverless
```

## Caching
| Data | TTL | Invalidation |
|------|-----|-------------|
| Trust scores | 5 min | On score change |
| Brand catalog | 1 hour | On admin update |
| Active listings | Real-time | On status change |
| Home feeds | 5 min | Scheduled refresh |