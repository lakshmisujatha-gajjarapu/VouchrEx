# 03 — User Personas & Journeys

## Personas

**Seller — "Rahul":** 32, IT pro, HDFC Infinia, gets ₹8K/yr in unwanted SmartBuy vouchers
**Buyer — "Priya":** 26, startup employee, budget-conscious, wants ₹500 Myntra voucher for ₹400
**Corporate — "Sneha":** 30, gets ₹5K/quarter in Sodexo brands she doesn't use

## Seller Journey

```
Download → Phone OTP → Profile → KYC (optional, limits access)
    │
    ▼
Tap "Sell" → Select Brand → Enter Code (encrypted instantly)
    → Enter Face Value → Platform Suggests Price → Set Price
    → Enter Expiry → Upload Proof (optional)
    │
    ▼
VERIFICATION GATE
├── Auto-verifiable brand? → Auto-check → Valid: Listed ✅ / Invalid: Rejected ❌
└── Not auto-verifiable? → Trusted seller: Auto-list / New seller: Manual review
    │
    ▼
LISTING LIVE → Wait for buyer → Buyer confirms → PAYOUT
├── Gold seller: Same-day
├── Silver: T+1
└── Bronze/New: T+3
```

## Buyer Journey

```
Open App → Browse (Trending / Expiring / Best Discounts / Search)
    │
    ▼
Tap "BUY NOW" → Order Summary (price + fee + savings) → Pay (UPI/Card)
    │
    ▼
PAYMENT SUCCESS → Money in ESCROW (not seller)
    │
    ▼
CODE REVEALED (watermarked image, deep link to brand app)
Timer starts: 2 hours
    │
    ├── "✅ Code Works" → Escrow released → Done
    ├── "❌ Report Issue" → Dispute flow
    └── No response → Auto-confirm after timeout
```

## Admin Journey

```
Daily: Review flagged listings, resolve disputes (24-48hr SLA), KYC reviews, fraud dashboard
Weekly: Fraud pattern analysis, trust score review, payment reconciliation
Monthly: Economics review, algorithm tuning, policy updates
```