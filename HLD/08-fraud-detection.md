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

### Phase 1 Implementation Scope (B+, symmetric)

Strikes are **symmetric** and applied at dispute resolution time, never on raise:

- `REFUND_BUYER` → **seller strike** (the seller was held responsible).
- `RELEASE_TO_SELLER` → **buyer strike**, but only when the dispute was raised by the buyer (`Dispute.raisedById === Order.buyerId`). Seller-raised disputes resolved in the seller's favor do not strike the buyer.

Implemented in Phase 1:

- New `User.sellerStrikes` and `User.buyerStrikes` counters (both monotonic, no decay).
- `User.trustScore` decremented by -15 / -25 / -40 per strike on either side (floored at 0). Strike 4+ also applies -40.
- `User.tier` recomputed from new score: ≥80 Gold, ≥50 Silver, ≥30 Bronze, else Blocked.
- `User.status → SUSPENDED` automatically at strike 3 on either side (no auto un-suspend). A SUSPENDED buyer cannot purchase; a SUSPENDED seller cannot list.
- **Payout hold (seller side only)**: `User.payoutHoldUntil` set to `now + 7d` on seller-strike 1, `now + 14d` on seller-strike 2, indefinite on seller-strike 3+. Buyer strikes do not touch `payoutHoldUntil` (buyers have no payouts to hold).
- Old rate-based auto-suspend (`disputeCount / totalSales > threshold`) is **removed** — replaced by the strike system. `disputeCount` is kept as a fraud signal (count of disputes raised against the seller, regardless of outcome).
- Audit log row per strike: `seller.strike_applied` or `buyer.strike_applied` with `{ disputeId, role, strikeNumber, scoreBefore, scoreAfter, tierBefore, tierAfter, payoutHoldUntil?, suspended }`.

### Dispute adjudication aids

The strike system does not detect single-incident fraud — it makes admin-adjudicated fraud progressively expensive. Phase 1 adds three aids that improve per-incident adjudication without requiring brand-API integration:

1. **Mandatory buyer-side evidence** — buyer-raised disputes must include at least one screenshot URL. Empty-evidence disputes are rejected at the API layer.
2. **Dispute timeline panel** — admin disputes view shows `orderCreated → codeRevealed → disputeRaised → autoConfirmAt` with deltas, flagging last-minute disputes (B07) in warning color.
3. **Buyer history panel** — admin disputes view shows the buyer's total purchases, disputes raised, disputes lost, and current `buyerStrikes`, computed from existing data plus the new field.

Brand-API auto-resolution (HLD/09) remains the long-term silver bullet and is out of Phase 1 scope.

Deferred (out of Phase 1 scope):

- **Strike 2 listing cap (max 2 listings)** — Bronze tier already caps at 2 listings via the tier privilege table in `07-trust-escrow-engine.md`; relying on tier-based enforcement until that gap is verified.
- **Strike 4 permanent ban + Aadhaar blacklist** — `UserStatus` enum has no `BANNED` value, and no KYC-blacklist table exists yet. Strike 4+ currently behaves like strike 3 (SUSPENDED + indefinite payout hold) until KYC blacklist infrastructure is built.
- **Score / strike recovery / decay** — strikes are permanent in Phase 1. Reputation recovery is a separate Phase 2 design.