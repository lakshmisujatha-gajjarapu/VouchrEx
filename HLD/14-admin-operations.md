# 14 — Admin & Operations

## Dashboard

```
TODAY: GMV ₹3.5L | Txns 847 | Disputes 12 (1.4%) | Revenue ₹42K

QUEUES:
├── Disputes: 12 open (SLA: 24hr)
├── KYC Review: 5 pending
├── Fraud Alerts: 3 active
├── Listing Review: 4 (new sellers)
└── High-Value Txns: 2 (>₹5000)

TRUST: Gold 12% | Silver 43% | Bronze 36% | Blocked 9%
TOP BRANDS: Amazon 35% | Flipkart 20% | Myntra 12%
```

## Configurable Settings
- Fraud rules (enable/disable/tune)
- Commission rates (per brand/category)
- Verification windows (per brand)
- Trust score weights
- KYC requirements per tier
- Payout schedules
- Brand catalog
- Feature flags

## Ops Team Structure (at scale)
```
Trust & Safety: L1 Dispute Resolution (2-3) → L2 Fraud Investigation (1-2) → L3 Policy (1)
Support: L1 Chat/Email (2-3) → L2 Technical Escalation (1)
Finance: Payment reconciliation, payout management
```