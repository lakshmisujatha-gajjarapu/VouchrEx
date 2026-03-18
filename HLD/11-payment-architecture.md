# 11 — Payment Architecture

## Razorpay Route (Escrow + Split + Payout)

### Flow 1: Collection
```
Buyer → Razorpay Checkout → UPI/Card → ₹430 held in Razorpay Account (ESCROW)
```

### Flow 2: Payout (on confirmation)
```
Razorpay Account → Route Transfer → Seller's Linked Bank Account
₹430 held → Seller: ₹370 | Platform: ₹50 | Razorpay: ₹10
```

### Flow 3: Refund (on dispute — buyer wins)
```
Razorpay Account → Refund API → Buyer's original payment method
₹430 → Full refund (UPI: instant, Card: 5-7 days)
```

## Payment Methods by Trust Tier

| Tier | UPI | Debit Card | Credit Card | Wallet |
|------|-----|-----------|------------|--------|
| Gold | ✅ | ✅ | ✅ | ✅ |
| Silver | ✅ | ✅ | ❌ | ❌ |
| Bronze/New | ✅ | ❌ | ❌ | ❌ |

UPI preferred because chargeback risk is near-zero.

## Reconciliation
Daily job checks: payment collected? escrow matches DB? payout triggered? payout completed? refund processed? commission correct?
Mismatches → auto-alert finance team.

## Payout Schedule
- Gold sellers: Same-day
- Silver: T+1
- Bronze/New (first 5 sales): T+3