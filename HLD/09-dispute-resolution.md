# 09 — Dispute Resolution Engine

## Dispute Flow

```
Buyer: "Code doesn't work"
    │
    ▼
EVIDENCE COLLECTION
├── Buyer: Screenshot (required) + description (required) + video (optional)
├── Seller: Notified, 24hr to respond with proof
    │
    ▼
AUTO-RESOLUTION ATTEMPT
├── Auto-verify code via brand API
│   ├── Code VALID → Guide buyer to retry, no refund
│   ├── Code INVALID → Seller fault, auto-refund
│   ├── Code REDEEMED before reveal → Seller fault, refund + ban
│   ├── Code REDEEMED after reveal → Check buyer history
│   └── API unavailable → Check histories, decide
├── Check buyer/seller dispute histories
├── Calculate confidence score
    │
    ▼
├── HIGH CONFIDENCE (>85%) → Auto-resolve
└── LOW CONFIDENCE (<85%) → Manual review queue (SLA: 24-48hr)
    │
    ▼
RESOLUTION → Refund buyer OR Release to seller
    │
    ▼
APPEAL (one-time, 48hr window, new evidence only, senior review, FINAL)
```

## Resolution Matrix

| Code Status | Buyer History | Decision |
|------------|---------------|----------|
| INVALID (API confirmed) | Any | Auto-refund |
| REDEEMED before reveal | Any | Auto-refund + ban seller |
| REDEEMED after reveal | Clean (0-1 disputes) | Refund (benefit of doubt) |
| REDEEMED after reveal | Suspicious (3+) | Manual review |
| Cannot check | Clean | Refund (benefit of doubt) |
| Cannot check | Suspicious | Manual review |
| VALID (API confirmed) | Any | No refund, guide retry |

## SLAs

| Type | Target |
|------|--------|
| Auto-resolved | < 1 hour |
| Standard | < 24 hours |
| Complex/high-value | < 48 hours |
| Appeals | < 72 hours |