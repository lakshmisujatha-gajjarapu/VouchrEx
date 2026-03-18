# 19 — Non-Functional Requirements

## Performance

| Metric | Target |
|--------|--------|
| API P50 latency | < 200ms |
| API P95 latency | < 500ms |
| API P99 latency | < 1000ms |
| Search response | < 300ms |
| Code reveal time | < 2 seconds |
| App cold start | < 3 seconds |

## Availability

| Component | Target |
|-----------|--------|
| Platform uptime | 99.9% |
| Database | 99.95% (Multi-AZ) |
| Escrow timer accuracy | ± 5 seconds |
| RPO | < 1 hour |
| RTO | < 4 hours |

## Security
- Encryption at rest: AES-256
- Encryption in transit: TLS 1.2+
- Voucher codes: AES-256-GCM with KMS
- Auth: JWT 30-min expiry
- Audit: All state changes logged, immutable
- Aadhaar: Hash only, never stored

## Compliance
- IT Act 2000
- DPDP Act 2023 (consent, data minimization, right to deletion)
- RBI PPI guidelines (monitor)
- GST on commission
- Consumer Protection Act (dispute resolution)
- Data localization (all data in India — AWS Mumbai)

## Monitoring Alerts

| Alert | Threshold |
|-------|-----------|
| Error rate | > 1% for 5 min |
| Latency P95 | > 1s sustained |
| DB CPU | > 80% for 10 min |
| Dispute rate | > 5% daily |
| Payment failures | > 5% hourly |