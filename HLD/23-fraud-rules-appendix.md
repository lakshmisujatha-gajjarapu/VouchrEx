# 23 — Appendix: Complete Fraud Rules

## Seller Rules

| ID | Rule | Trigger | Severity | Action |
|----|------|---------|----------|--------|
| S01 | >5 listings/hour | Listing | HIGH | Block |
| S02 | Code format invalid | Listing | CRITICAL | Reject |
| S03 | Duplicate code hash | Listing | CRITICAL | Reject+Strike |
| S04 | >₹5K + <5 sales | Listing | MEDIUM | Manual review |
| S05 | Discount >40% | Listing | MEDIUM | Manual review |
| S06 | 3+ invalid codes/24hr | Listing | HIGH | Suspend |
| S07 | Bank changed + immediate listing | Listing | HIGH | Hold payout |
| S08 | New device | Listing | MEDIUM | Extra verify |
| S09 | Expiry <48hrs | Listing | LOW | Block listing |
| S10 | 10+ same brand bulk | Listing | MEDIUM | Manual review |
| S11 | Price > face value | Listing | CRITICAL | Reject |
| S12 | Dormant 90d + sudden activity | Activity | MEDIUM | Extra KYC |

## Buyer Rules

| ID | Rule | Trigger | Severity | Action |
|----|------|---------|----------|--------|
| B01 | >3 purchases/hour | Purchase | HIGH | Block |
| B02 | Dispute rate >20% | Dispute | HIGH | Restrict |
| B03 | Dispute rate >40% | Dispute | CRITICAL | Suspend |
| B04 | 3+ disputes/7 days | Dispute | CRITICAL | Freeze |
| B05 | New + >₹500 purchase | Purchase | MEDIUM | UPI only |
| B06 | Same device as other user | Registration | CRITICAL | Block+Link |
| B07 | Dispute in last 10min of window | Dispute | MEDIUM | Higher scrutiny |
| B08 | 80%+ buys from new sellers | Purchase | MEDIUM | Flag |
| B09 | 3+ disputes same brand | Dispute | MEDIUM | Block brand |
| B10 | Similar evidence screenshots | Dispute | HIGH | Manual review |
| B11 | Bank chargeback | Payment | CRITICAL | Suspend+Blacklist |
| B12 | Timeout >50% of transactions | Activity | MEDIUM | Warning |

## Cross-Cutting Rules

| ID | Rule | Severity | Action |
|----|------|----------|--------|
| X01 | Buyer+Seller same IP | CRITICAL | Block txn |
| X02 | Buyer+Seller same device | CRITICAL | Block+Ban |
| X03 | Buyer+Seller same bank name | MEDIUM | Flag |
| X04 | Circular transactions (A→B→C→A) | HIGH | Flag all |
| X05 | Platform dispute rate >5%/hour | HIGH | Global alert |
| X06 | 5+ accounts same IP/24hr | CRITICAL | Block IP |
| X07 | Referrer+referee same device | HIGH | Block reward |

## Risk Score Weights

| Signal | Weight |
|--------|--------|
| Known fraudulent device | +40 |
| Multiple accounts same device | +35 |
| IP country mismatch | +25 |
| Rooted/jailbroken | +20 |
| Previous strike (seller) | +20/strike |
| Previous dispute (buyer) | +15/dispute |
| VPN/Proxy detected | +15 |
| Rapid sequential actions | +15 |
| New account (<24hr) | +10 |
| High value (>₹2K) | +10 |
| Counterparty is new | +10 |
| Unusual hour (1-5AM) | +5 |

## Thresholds

| Score | Action |
|-------|--------|
| 0-30 | Auto approve |
| 31-60 | Approve + log for review |
| 61-80 | Hold for manual review |
| 81-100 | Auto block |