# Vouchrex Marketplace Selling Strategy — Design Spec

**Date:** 2026-05-17  
**Last updated:** 2026-05-18  
**Status:** Phase 1 & 2 shipped — Phase 3 in planning  
**Scope:** Full app overhaul — shop, sell, listings, orders, inbox, push notifications  

---

## Problem Statement

Vouchrex is a transaction engine, not a marketplace. Every screen is passive — users arrive with intent already formed and the app just processes it. There is no mechanism to:

- Create desire or intent before the user decides to spend money elsewhere
- Build daily habit or give users a reason to open the app unprompted
- Guide sellers to price correctly or motivate them to list more
- Convert a first-time buyer into a repeat customer

The result: low engagement, high drop-off after first transaction, no retention loop.

---

## User Archetypes

### Type A — Opportunistic Buyer
Opens the app when they are *about to spend money* (ordering dinner, about to shop online). High intent, time-pressured. Converts in under 60 seconds or leaves. Needs fast discovery, instant trust, and frictionless payment.

### Type B — Deal Hunter
Browses for the thrill of finding a deal. Checks in the morning, at lunch. Low urgency, high frequency. Needs fresh inventory signals and a compelling reason to open the app daily.

### Type C — Accidental Seller
Has unused vouchers sitting in email or saved in apps. Does not know they can sell. Does not know how easy it is. Needs education, a visible earnings preview, and the lowest possible friction to list.

---

## Design Pillars

1. **Pre-intent interception** — reach the user before they decide to spend money elsewhere
2. **Every transaction breeds the next** — post-purchase moments are marketing moments
3. **Sellers need to feel guided, not interrogated** — pricing intelligence replaces guesswork
4. **Trust is the product** — escrow protection is the differentiator; it must be front and center
5. **Inventory-conditional marketing** — never push a deal that has no inventory

---

## 1. Dinner Push Strategy

### Why 7 PM fails
At 7 PM the user is already on Swiggy. The interception window is **5:15–6:30 PM** — when hunger is forming but the platform decision has not been made.

### The Dinner Funnel

| Time | Action | Condition |
|---|---|---|
| 5:15 PM | Soft push: "Tonight's dinner deals are live early 🍜 — Swiggy 28% off" | ≥ 2 active food-category listings |
| 6:00 PM | Shop: "Dinner Tonight" section rises to top of screen | Device time ≥ 18:00 |
| 6:30 PM | Hard push to non-openers: "Don't pay full price for dinner — grab a voucher now" | User did not open app after 5:15 PM push |
| 7:30 PM | Scarcity push: "Last 2 Swiggy vouchers tonight" | Active food listings ≤ 3 |
| 9:00 PM | Dinner section demotes. No further pushes. | — |

### Inventory-Conditional Requirement
The push scheduler **must** check live inventory count before firing any push. A push fired against zero inventory trains users to ignore notifications and permanently degrades the channel.

### Admin Configuration
Promotion window times (start, end, category, minimum inventory threshold) are admin-configurable from the console via `PromotionWindow` table. They cannot be hardcoded in the app binary.

**Status: ✅ Shipped** — `MarketingScheduler` fires every minute, checks `PromotionWindow`, verifies inventory before sending.

---

## 2. Shop Screen Overhaul

### Section order, dynamic by time of day

```
┌─────────────────────────────────┐
│  Deal of the Day                │  ← admin-pinned via AppConfig `deal_of_day`
├─────────────────────────────────┤
│  {Time-based section}           │  ← see Time Windows below
├─────────────────────────────────┤
│  Expiring Soon                  │  ← expiryDate < 48 hours
├─────────────────────────────────┤
│  New This Hour                  │  ← createdAt < 2 hours ago
├─────────────────────────────────┤
│  Best Deals Right Now           │  ← top 5 by discountPercent
├─────────────────────────────────┤
│  All Listings                   │  ← full list below fold
└─────────────────────────────────┘
```

Sections are deduplicated — a listing that qualifies for multiple sections only appears once (priority top to bottom). Own listings excluded from all sections (API-level filter when session token present).

**Time Windows (device local time):**

| Window | Hours | Section headline |
|---|---|---|
| Morning | 07:00–09:00 | Morning picks |
| Lunch | 12:00–14:00 | Lunch break deals |
| Pre-dinner | 17:15–21:00 | Dinner tonight 🍜 |
| Night owl | 22:00–00:00 | Night owl |
| Weekend (Sat/Sun) | All day | Weekend vibes |

**Hero copy:**
- `"Save up to 35% on your favorite food, travel, and shopping brands."` (with dynamic time-based title)
- If user has prior savings: `"🎉 You've saved ₹X total on Vouchrex!"` 

### Listing Card

Compact horizontal layout — brand logo left, all info right:
- Brand logo (from `Brand.logoUrl`, letter avatar fallback)
- Brand name + Verified pill + "New" pill (< 2h old) in one row
- Price + strikethrough face value + discount % pill
- Expiry: "Xd left" badge (red) when < 7 days, plain date otherwise
- Left accent bar turns red when ≤ 2 days to expiry

### Trust Hero Banner

One-time dismissible banner for users with zero prior saves (`user.totalSaved === 0`):
> *"Vouchrex uses escrow — your money only releases when you confirm the voucher works. You cannot lose."*

Dismissed state persisted in SecureStore.

**Status: ✅ Shipped**

---

## 3. Sell Screen Overhaul (Sales Heaven)

### Header

> **"Turn unused vouchers into cash in 5 minutes"**

Speaks directly to Type C sellers before they see a single form field.

### Smart Clipboard Detection

On entering the Sell tab, scan the clipboard for a plausible voucher code (alphanumeric, 8–20 chars) using `expo-clipboard`.

- Pre-fill the voucher code field with the detected value
- Show a prompt: *"Looks like you have a code copied. Tap to use it."*
- Seller still selects brand and confirms — no face value is inferred from the clipboard

**Note:** Only pre-fill the code field. Do not claim a ₹ value from clipboard content — that cannot be determined without brand context and would erode trust.

**Status: 🔲 Not built**

### Demand Pulse

As soon as a brand is selected, show live buyer demand using real platform data:

> *"🔥 12 buyers are waiting for a Swiggy voucher right now"*  
> *"At 15% off, Swiggy vouchers on Vouchrex sell in under 4 hours"*

Data sources:
- Buyer count: `BrandAlert` count for selected `brandId` where `active = true`
- Sell time estimate: derived from `brand.avgDiscountPercent` (see seller engagement playbook for tier table)

**Only show if alert count ≥ 2.** "0 people waiting" or "1 person waiting" kills the motivational effect.

Requires: `GET /alerts/count/:brandId` — lightweight public endpoint returning `{ count: number }`.

**Status: 🔲 Not built — highest ROI item in Phase 3**

### Pricing Intelligence

After brand selection, surface avg market rate:

> *"Swiggy vouchers on Vouchrex sell at avg 15% off. Price yours at ₹850 to sell 2× faster."*

With a **"Use suggested price"** button that auto-fills selling price at `brand.avgDiscountPercent + 2%`.

**Status: ✅ Shipped** — `selectedBrandAvg` state, IIFE banner in sell.tsx

### Live Earnings Preview

```
┌─────────────────────────────────────┐
│  You earn          ₹850             │
│  Buyer saves       ₹150 (15% off)   │
│  Status:           ✓ Priced to sell │
└─────────────────────────────────────┘
```

Status line tiers:
- `< 10%` → "Price a bit low — buyers may not notice the deal"
- `10–20%` → "✓ Priced to sell fast"
- `> 20%` → "🔥 Great deal — will sell quickly"

**Status: ✅ Shipped**

### Post-Listing Success Screen

> *"{Brand} is live! 🎉*  
> *Average sell time for this brand: ~4 hours.*  
> *We'll notify you the moment it sells."*

If Demand Pulse data is available, append:
> *"We just notified {X} buyers who were waiting for this."*

This is the honest, specific version of the "Money in Flight" concept — framing the listing as cash in motion without a fake pipeline tracker that implies immediate payout.

**Status: ✅ Shipped** (without the alert count line — add when Demand Pulse is built)

---

## 4. Listings Screen

### Earnings Summary Strip

> *"You've earned ₹4,200 total on Vouchrex"*

Uses `user.totalEarned` from the API.

**Status: ✅ Shipped**

### Expiry Nudge with One-Tap Reprice

When `expiryDate < 72 hours`, status ACTIVE, no active order:

```
⚠ Your Amazon ₹1,000 card expires in 2 days.
Drop price 5% to sell it now.    [Reprice →]
```

"Reprice →" opens edit listing with selling price pre-filled at `currentPrice × 0.95`.

**Status: ✅ Shipped**

### View Counter (Phase 3)

Backend: increment `CodeVault.viewCount` on `GET /listings/:id`. Display on listing detail: *"8 people viewed this listing"*.

**Status: 🔲 Not built**

---

## 5. Post-Purchase Cross-Sell Screen

When order status transitions to CONFIRMED or AUTO_CONFIRMED:

```
🎉 You just saved ₹180 today.
Your Swiggy 30% voucher is secured.

[Shop Again]         [Sell a Voucher]
```

- "Shop Again" → shop tab
- "Sell a Voucher" → sell tab

Dismissible, shown once per order.

**Status: ✅ Shipped**

---

## 6. Watchlist / Alert Me

### Surfaces

1. **Shop empty state** — "No vouchers available right now. [Alert me when one is listed →]"
2. **Listing detail** — bell icon in top bar toggles alert for that brand

### Trigger
New listing created → check `BrandAlert` table → push immediately to matching users (excluding the seller).

### Data model
`BrandAlert { userId, brandId, createdAt, active }` — @@unique([userId, brandId])

**Status: ✅ Shipped** — `AlertsController`, `AlertsService`, push trigger in `listings.service.ts`

---

## 7. Inbox as Marketing Channel

| Event | Copy | Timing |
|---|---|---|
| Brand alert triggered | "New Swiggy voucher just listed at 28% off 🍕" | Immediate on listing creation |
| Post-purchase nudge | "You saved ₹X today. Shop again?" | 2 hours after order CONFIRMED |
| Repeat-buyer signal | "Your favourite brand [Amazon] just got listed" | If user bought that brand before |
| Savings milestone | "You've saved ₹500 with Vouchrex this month 🎉" | On milestone cross |
| Seller listing expiry | "Your [Brand] card expires tomorrow. Drop price to sell it." | 24 hours before expiry |

**Status: 🔲 Not built** (inbox infrastructure exists, new event types not wired)

---

## 8. Push Notification Calendar

| Time | Push | Condition |
|---|---|---|
| 5:15 PM daily | "Tonight's dinner deals are live early 🍜" | ≥ 2 food listings, user not opened today |
| 6:30 PM daily | "Don't pay full price tonight" | User did not open after 5:15 PM push |
| 7:30 PM daily | "Last 2 Swiggy vouchers tonight" | Active food listings ≤ 3 |
| 7:00 AM (contextual) | "Good morning — [Brand] 20% off just listed ☕" | Shopping/food listing < 6 hours old |
| 1st of month | "New month — unused vouchers? Turn them into cash." | Sellers with no listing in last 30 days |
| Expiry day | "Your [Brand] voucher expires TODAY — reprice to sell it." | Active listing, expiryDate = today |
| Brand alert | "New [Brand] voucher listed at X% off" | Watchlist match on listing creation |

**Rule**: No push fires if its inventory condition is not met.

**Status: ✅ Dinner funnel scheduler shipped. Expiry/seller pushes in Phase 3 (see seller engagement playbook).**

---

## 9. Build Phases

### Phase 1 — Make the app feel alive ✅ Complete

- [x] Time-aware shop sections driven by device time
- [x] Shop hero copy rewrite
- [x] Listing card: brand logo, expiry urgency badge, "Just listed" badge
- [x] Post-purchase success screen
- [x] Post-listing confirmation screen
- [x] Sell screen headline
- [x] Live pricing status

### Phase 2 — Make the app proactive ✅ Complete

- [x] Dinner push funnel (5:15 PM / 6:30 PM / 7:30 PM, inventory-gated)
- [x] Admin-configurable promotion windows (`PromotionWindow` table)
- [x] Pricing intelligence with suggested price autofill
- [x] Earnings summary strip on listings screen
- [x] Reprice nudge for expiring listings
- [x] Deal of the Day slot (AppConfig `deal_of_day` key)
- [x] Trust hero banner for first-time buyers
- [x] Own listings excluded from shop (API-level, session token)
- [x] Watchlist / BrandAlert (shipped ahead of schedule)

### Phase 3 — Build the retention hook 🔲 In progress

- [ ] **Demand Pulse** — `GET /alerts/count/:brandId`, shown in sell flow on brand select
- [ ] **Clipboard code pre-fill** — `expo-clipboard` detect on Sell tab entry
- [ ] Seller engagement scheduler (T+24h health nudge, T+48h reprice, expiry countdown)
- [ ] New inbox notification types (brand alert, post-purchase nudge, seller expiry, savings milestone)
- [ ] Listing view counter (backend increment + display)
- [ ] Post-listing screen shows alert count ("We notified X buyers")
- [ ] Payout completed push

### Phase 4 — Growth mechanics 🔲 Planned

- [ ] Savings tracker on profile (shareable milestone)
- [ ] Seller earnings narrative on sell tab hero
- [ ] WhatsApp share on listing detail (deep link)
- [ ] Referral mechanic — ₹50 off first purchase
- [ ] Seller streak badge
- [ ] Price drop alert (seller reprices → push to recent viewers)

---

## Decisions

1. **Promo window config** lives in `PromotionWindow` table, managed via admin console. Not in AppConfig JSON — it's a proper first-class model.
2. **Brand logos** stored in `Brand.logoUrl`, fetched from Brandfetch at brand creation time. The DB is the cache.
3. **Suggested price formula** is `brand.avgDiscountPercent + 2%` for Phase 1–2. Phase 3 will factor in active competing listing count.
4. **Post-purchase screen** triggers on the existing realtime order socket event — no polling.
5. **Watchlist at scale** — direct push per match is fine for current volume. Fan-out moves to a background queue before thousands of alerts per popular brand.
6. **Demand Pulse threshold** — only show buyer count if `BrandAlert.count ≥ 2`. Never show "0 buyers waiting."
7. **Clipboard detection** — pre-fill code field only. Never claim a ₹ value from clipboard content (cannot be inferred without brand context).
