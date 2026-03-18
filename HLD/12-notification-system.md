# 12 — Notification System

## Event-Driven Architecture

```
Events → Notification Router → Push (Firebase) / SMS (MSG91) / Email (SendGrid) / In-App (WebSocket)
```

## Notification Matrix

| Event | Push | SMS | Email | In-App | Who |
|-------|------|-----|-------|--------|-----|
| Voucher sold | ✅ | ✅ | ✅ | ✅ | Seller |
| Payment received | ✅ | | | ✅ | Buyer |
| Code revealed | ✅ | | | ✅ | Buyer |
| Reminder (30 min left) | ✅ | ✅ | | ✅ | Buyer |
| Reminder (5 min left) | ✅ | ✅ | | ✅ | Buyer |
| Auto-confirmed | ✅ | | ✅ | ✅ | Both |
| Dispute raised | ✅ | ✅ | ✅ | ✅ | Seller |
| Dispute resolved | ✅ | ✅ | ✅ | ✅ | Both |
| Payout completed | ✅ | | ✅ | ✅ | Seller |
| Trust score changed | ✅ | | | ✅ | User |
| Voucher expiring (48hr) | ✅ | | | ✅ | Seller |
| Account suspended | ✅ | ✅ | ✅ | ✅ | User |
| KYC approved | ✅ | ✅ | | ✅ | User |

## Critical Timing (Code Reveal → Deadline)

```
T+0:00  Code revealed → "Verify within 2 hours"
T+1:00  "⏰ 1 hour remaining"
T+1:30  "⚠️ 30 minutes left!" [Push + SMS]
T+1:55  "❗ 5 minutes! After this, auto-confirmed" [Push + SMS]
T+2:00  Auto-confirm → both notified
```