# 07 — Trust & Escrow Engine

## The Core Problem

```
SELLER FRAUD: "Here's a dead code, give me money"
BUYER FRAUD:  "I used the code but I'll say it didn't work, refund me"

Platform must protect BOTH sides from EACH OTHER.
```

## Escrow State Machine

```
CREATED → FUNDED (payment confirmed) → ACTIVE (code revealed, timer running)
  → RELEASING → RELEASED (buyer confirms or timeout)
  → HELD (buyer disputes) → REFUNDED (buyer wins) or RELEASED (seller wins)
  → CANCELLED (payment fails)
```

## Financial Flow

```
₹500 Amazon gift card selling at ₹420

Buyer pays: ₹420 + ₹10 platform fee = ₹430 → ESCROW

On confirmation:
  Seller gets:  ₹370 (price minus 12% commission)
  Platform:     ₹50  (commission)
  Razorpay:     ₹10  (gateway fee ~2%)
```

## Verification Windows

| Voucher Type | Window |
|-------------|--------|
| Amazon/Flipkart | 2 hours |
| Swiggy/Zomato | 2 hours |
| Myntra/Ajio | 3 hours |
| Travel (MMT etc) | 4 hours |
| High Value (>₹2000) | 4 hours |
| Gaming/Digital | 1 hour |

## Auto-Confirm on Timeout

```
When verification window expires and buyer hasn't responded:
→ AUTO-CONFIRM → Release escrow to seller

WHY: Without this, buyers could use code and never confirm.
Buyer is warned at: code reveal, 1hr left, 30min left, 5min left.

Post-timeout dispute possible for 24hrs but with HIGHER burden of proof.
```

## Trust Tiers & Privileges

| Tier | Score | Max Value | Listings | Payout | Payment |
|------|-------|-----------|----------|--------|---------|
| 🥇 Gold | 80-100 | ₹10,000 | 20 | Same-day | UPI+Cards+Wallets |
| 🥈 Silver | 50-79 | ₹5,000 | 10 | T+1 | UPI+Cards |
| 🥉 Bronze | 30-49 | ₹500 | 2 | T+3 | UPI only |
| 🚫 Blocked | 0-29 | N/A | 0 | Frozen | N/A |