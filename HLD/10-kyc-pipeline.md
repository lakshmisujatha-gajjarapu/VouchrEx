# 10 — KYC Pipeline

## KYC Levels

| Level | Verification | Access |
|-------|-------------|--------|
| 0 | Phone OTP | Browse only |
| 1 | Phone + Email | Buy only, max ₹500, 3/month |
| 2 | + Aadhaar | Buy + Sell, max ₹2000 |
| 3 | + Bank + Liveness | Full access |

## KYC Flow

```
Step 1: AADHAAR (DigiLocker API)
├── User authorizes via DigiLocker
├── We receive: Name, DOB, Photo
├── We store: Aadhaar HASH only (never actual number)
├── Duplicate check: Hash already exists? → Block (duplicate account)
└── Trust score: +20

Step 2: BANK ACCOUNT (Penny Drop)
├── User enters: Account number, IFSC, Holder name
├── System sends ₹1, verifies name matches Aadhaar
├── Exact match → Pass / Fuzzy (80%+) → Pass with flag / No match → Reject

Step 3: LIVENESS (Phase 2 — HyperVerge/IDfy)
├── Selfie with blink + head turn
├── Compare with Aadhaar photo
├── >80% match → Pass / 50-80% → Manual review / <50% → Reject
```

## Voucher Auto-Verification

| Brand | Method | Reliability |
|-------|--------|-------------|
| Amazon | Balance check page | ✅ High |
| Flipkart | Balance check page | ✅ High |
| Myntra | Checkout apply test | ⚠️ Medium |
| Swiggy | Coupon apply API | ⚠️ Medium |
| Others | Buyer verification window | Manual fallback |

## Guaranteed Vouchers
For auto-verifiable brands, platform guarantees validity. Buyer pays slightly more, gets zero-risk experience. Platform absorbs losses on rare failures.