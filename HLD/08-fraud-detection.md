# 08 — Fraud Detection System

## 3-Layer Pipeline

```
Every action passes through:

LAYER 1: REAL-TIME RULES ENGINE
├── Velocity checks (too many listings/purchases per hour)
├── Value checks (new user + high value = block)
├── Device checks (duplicate accounts, rooted)
├── Self-dealing (buyer IP = seller IP)
├── PASS → Continue / FAIL → Block

LAYER 2: RISK SCORING
├── Combines: user trust, txn value, time, device age, counterparty
├── Score 0-30: AUTO APPROVE
├── Score 31-60: APPROVE + LOG
├── Score 61-80: HOLD for review
├── Score 81-100: AUTO BLOCK

LAYER 3: BEHAVIORAL ANALYSIS (Async)
├── Dispute rate trends
├── Network analysis (linked accounts)
├── Pattern matching vs known fraud
├── Output: Fraud Signals for ops team
```

## Seller Rules

| ID | Rule | Severity | Action |
|----|------|----------|--------|
| S1 | >5 listings/hour | HIGH | Block |
| S2 | Code format mismatch | CRITICAL | Reject |
| S3 | Duplicate code hash | CRITICAL | Reject+Strike |
| S4 | >₹5K + new seller | MEDIUM | Manual review |
| S5 | Discount >40% | MEDIUM | Manual review |
| S6 | Multiple failures/24hr | HIGH | Temp suspend |
| S7 | Bank changed + listing | HIGH | Hold payout |

## Buyer Rules

| ID | Rule | Severity | Action |
|----|------|----------|--------|
| B1 | >3 purchases/hour | HIGH | Block |
| B2 | Dispute rate >20% | HIGH | Restrict |
| B3 | Dispute rate >40% | CRITICAL | Suspend |
| B4 | 3+ disputes/7 days | CRITICAL | Freeze |
| B5 | New + high value | MEDIUM | UPI only |
| B6 | Same device as other user | CRITICAL | Block+Link |
| B7 | Last-minute dispute | MEDIUM | Higher scrutiny |

## Cross-Cutting Rules

| ID | Rule | Action |
|----|------|--------|
| X1 | Buyer & Seller same IP | Block transaction |
| X2 | Buyer & Seller same device | Block + Ban both |
| X3 | VPN/Proxy detected | Extra KYC |
| X4 | Platform dispute spike >5% | Global alert |

## Seller Strike System

```
Strike 1: Warning + payout delayed 7d + score -15
Strike 2: Restricted (max 2 listings) + payout delayed 14d + score -25
Strike 3: SUSPENDED 30 days + score -40
Strike 4: PERMANENT BAN + Aadhaar blacklisted
```