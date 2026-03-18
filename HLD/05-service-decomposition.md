# 05 — Service Decomposition

## Modules

| Module | Responsibility |
|--------|---------------|
| User | Auth, profile, KYC, trust scores, device mgmt |
| Voucher | Listings, brand catalog, code vault, search, verify, pricing |
| Transaction | Orders, escrow, code reveal, timers, audit trail |
| Fraud | Rules engine, risk scoring, velocity checks, behavioral analysis |
| Dispute | Evidence collection, resolution, appeals |
| Payment | Collection, escrow hold/release, payout, refund, reconciliation |
| Notification | Push, SMS, email, WhatsApp, in-app |
| Admin | Dashboard, ops queues, config, reports |

## User Module

```
Auth Service: Phone OTP, JWT (30-min access + 7-day refresh), session mgmt
Profile Service: Name, city, preferences
KYC Service: Aadhaar (DigiLocker), bank (penny drop), liveness (HyperVerge)
Trust Score Service: Event-driven calculation, tier assignment, decay
Device Service: Fingerprinting, multi-account detection, root detection
```

### Trust Score

```
Score = (Identity × 0.25) + (Transactions × 0.30) + (Disputes × 0.25)
      + (Account Age × 0.10) + (Community × 0.10)

Events: KYC complete +20, successful txn +2-5, dispute lost -25-30
Decay: Inactive 30d -5, 90d -15

Tiers: Gold (80-100), Silver (50-79), Bronze (30-49), Blocked (0-29)
```

## Voucher Module

### Code Vault
- AES-256-GCM encryption, keys in AWS KMS
- Hash (SHA-256) for duplicate detection
- Max 3 views per buyer, each logged
- Watermarked image rendering (not copyable text)

### Listing State Machine
```
DRAFT → VERIFYING → ACTIVE → RESERVED → SOLD
                  → REJECTED              → DISPUTED → REFUNDED/SOLD
                                          → AUTO_CONFIRMED → SOLD
         ACTIVE → EXPIRED (if expiry date passes)
         RESERVED → ACTIVE (if buyer cancels before reveal)
```

## Transaction Module

### Transaction States
```
INITIATED → PAYMENT_PENDING → PAYMENT_SUCCESS → ESCROW_ACTIVE
         → PAYMENT_FAILED → CANCELLED

ESCROW_ACTIVE → CODE_REVEALED (timer starts)
             → CONFIRMED (buyer confirms) → COMPLETED
             → AUTO_CONFIRMED (timeout) → COMPLETED
             → DISPUTED → REFUNDED or CONFIRMED → COMPLETED
```