# 11 — Payment Architecture

## Overview

Full Razorpay stack — no manual admin transfers, no Aadhaar KYC gate for payouts.
Sellers register a UPI ID (or bank account) once. Every confirmed sale auto-triggers
a Razorpay Payout to their registered account.

---

## Seller Onboarding (one-time, before first listing)

```
Seller enters UPI ID (e.g. 9876543210@ybl)
        ↓
POST /payout-accounts
        ↓
API creates Razorpay Contact → gets razorpayContactId
        ↓
API creates Razorpay Fund Account (VPA) → gets razorpayFundAccountId
        ↓
SellerPayoutAccount saved in DB (verified = true)
        ↓
Seller sees: "UPI 9876543210@ybl registered for payouts ✅"
```

Seller can update UPI or add a bank account at any time.
New fund account is created on Razorpay; old one is retained for audit.

---

## Payment Collection Flow

```
Buyer → Razorpay Payment Link (UPI / Card / Wallet)
      → Payment captured → stored in platform Razorpay account (escrow)
      → Order status: ESCROW_ACTIVE
```

Payment methods available by trust tier:

| Tier       | UPI | Debit Card | Credit Card | Wallet |
|------------|-----|-----------|------------|--------|
| Gold       | ✅  | ✅        | ✅         | ✅     |
| Silver     | ✅  | ✅        | ❌         | ❌     |
| Bronze/New | ✅  | ❌        | ❌         | ❌     |

UPI preferred — zero chargeback risk, instant settlement.

---

## Payout Flow (on order confirmation)

```
Buyer confirms (or 48h auto-confirm timer fires)
        ↓
Order status → CONFIRMED / AUTO_CONFIRMED
Escrow status → RELEASED
        ↓
API looks up seller's razorpayFundAccountId
        ↓
POST https://api.razorpay.com/v1/payouts
  { fund_account_id, amount: sellerPayout, mode: "UPI", purpose: "payout" }
        ↓
Payment.payoutStatus → PROCESSING
Payment.razorpayPayoutId saved
        ↓
Razorpay webhook: payout.processed
        ↓
Payment.payoutStatus → COMPLETED
Payment.payoutCompletedAt = now
Seller notified: "₹370 credited to 9876543210@ybl ✅"
```

### Payout Schedule by Trust Tier

| Tier       | When payout fires       | Max listing value |
|------------|------------------------|------------------|
| Gold       | Immediate on confirm   | ₹10,000          |
| Silver     | Immediate on confirm   | ₹5,000           |
| Bronze/New | Immediate on confirm   | ₹500             |

> No T+1 / T+3 delay — Razorpay UPI payouts settle in seconds. Trust tier still
> controls what the seller can list, not when they get paid.

---

## Refund Flow (dispute — buyer wins)

```
Admin resolves dispute → REFUND_BUYER
        ↓
Razorpay Refund API → buyer's original payment method
  UPI: instant  |  Card: 5-7 business days
Escrow status → REFUNDED
```

---

## Payout Failure Handling

```
Razorpay payout API fails (invalid VPA, account frozen, etc.)
        ↓
Payment.payoutStatus → FAILED
Payment.payoutFailureReason saved
Admin alerted via audit log
        ↓
Admin reviews: POST /admin/orders/:id/retry-payout
        OR
Admin transfers manually: POST /admin/orders/:id/complete-payout (fallback)
```

---

## Fee Breakdown Example

| Item               | Amount |
|--------------------|--------|
| Voucher face value | ₹500   |
| Selling price      | ₹420   |
| Platform fee (buyer pays) | ₹10 |
| Buyer total        | ₹430   |
| Commission (12%)   | ₹50    |
| **Seller payout**  | **₹370** |
| Razorpay gateway ~2% | ~₹9 (borne by platform) |
| Platform net       | ₹41    |

---

## Razorpay APIs Used

| Purpose              | Endpoint                              |
|----------------------|---------------------------------------|
| Collect payment      | POST /v1/payment_links                |
| Verify signature     | HMAC-SHA256 on orderId\|paymentId     |
| Create Contact       | POST /v1/contacts                     |
| Create Fund Account  | POST /v1/fund_accounts                |
| Trigger payout       | POST /v1/payouts                      |
| Refund buyer         | POST /v1/payments/:id/refund          |
| Webhook events       | payout.processed, payout.failed       |

---

## Reconciliation

Daily job checks:
- Payment captured → escrow matches DB amount
- Escrow RELEASED → payoutStatus not stuck in PROCESSING
- Payout COMPLETED → Razorpay payout ID is valid
- Commission calculated correctly for each order
- Mismatches → auto-alert finance team via audit log
