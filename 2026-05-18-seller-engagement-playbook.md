# Vouchrex Seller Engagement Playbook

**Date:** 2026-05-18  
**Last updated:** 2026-05-18  
**Status:** Phase 1 foundations shipped — scheduler & nudges in Phase 3  
**Scope:** All seller-facing nudges — push notifications, in-app prompts, pricing guidance, expiry recovery  

---

## The Problem

A seller lists a voucher and then goes silent. The app does nothing to help them succeed. Currently the only seller push is `listing.reserved` (you sold it). Everything before that — helping them price right, warning them before expiry, telling them the market is moving — is missing entirely.

The result: vouchers expire unsold, sellers blame the platform, and they never list again.

This document defines every proactive touchpoint in the seller journey, from listing creation to payout, with exact copy, exact triggers, and the discount guidance logic that sits underneath all of it.

---

## The Seller Journey Map

```
List → [Waiting to sell] → Sold → Code revealed → Confirmed → Payout
         ↑
   This entire window is currently silent.
   All the work in this doc happens here.
```

The waiting window has four distinct seller states that each need different treatment:

| State | What's happening | What seller needs |
|---|---|---|
| **Fresh** | Listed < 24 hours, no sale yet | Reassurance, expectation setting |
| **Stale** | Listed > 48 hours, no sale | Pricing nudge, urgency |
| **At-risk** | Expiry < 7 days, no sale | Graduated discount guidance |
| **Critical** | Expiry < 48 hours, no sale | Hard urgency — loss framing |

---

## 1. Listing Creation — The First 5 Minutes

### In-app: Post-listing confirmation screen

Shown immediately after "List Voucher Now" succeeds, before navigating away:

```
Your Swiggy voucher is live 🎉

Average sell time for this brand: ~4 hours
We'll notify you the moment it sells.

Your listing is priced at 15% off — priced to sell fast.
```

The sell-time estimate comes from `brand.avgDiscountPercent` + a rough lookup:
- `< 10% off` → "Sell time: typically 5–7 days"
- `10–15% off` → "Sell time: typically 1–2 days"
- `15–20% off` → "Sell time: typically a few hours"
- `> 20% off` → "Sell time: usually sells within the hour"

### Push: no push at listing creation (seller just did the action — they know)

---

## 2. Discount Guidance System

This is the core intelligence. Every seller-facing nudge that involves pricing uses one of four tiers:

| Discount % | Score | Copy tone | Suggested action |
|---|---|---|---|
| < 8% | Weak | "Buyers may scroll past this" | Raise to at least 10% |
| 8–14% | Fair | "Priced OK — will take a few days" | Consider 15% for faster sale |
| 15–20% | Good | "✓ Priced to sell fast" | Hold the price |
| > 20% | Hot | "🔥 Will sell quickly" | Nothing needed |

**Suggested reprice amounts** (used in all nudges):
- Weak → suggest `current discount + 7%`
- Fair → suggest `current discount + 5%`
- Stale Fair → suggest `current discount + 3%` (already fair, just needs a nudge)

**Example**: Seller listed ₹500 Swiggy voucher at ₹440 (12% off). After 36 hours unsold:
> "Your Swiggy voucher has had 6 views but no sale. At 12% off buyers are interested but hesitant — drop to ₹425 (15% off) and it'll sell today. [Reprice in one tap →]"

The reprice CTA pre-fills the edit listing screen with the suggested selling price.

---

## 3. Listing Health Nudges

These are time-based scheduler checks. Each fires once per listing, in order, and stops once the listing sells.

### Nudge 1 — 24 hours after listing, no sale

**Condition:** listing ACTIVE, no order, `createdAt < 24h ago`

**Push copy:**
> **"Your [Brand] voucher hasn't sold yet"**  
> "[Score-based line]"

Score-based line:
- Weak: "At [X]% off, buyers may not notice the deal. Try dropping to [suggested]%."
- Fair: "You're close — dropping to [suggested]% could close a sale today."
- Good: "You're priced well. Hang tight — vouchers at this discount usually sell within 48 hours."
- Hot: "Your price is great. Should sell very soon — check back later."

**In-app (listings screen):** show a subtle info badge on the listing card.

---

### Nudge 2 — 48 hours after listing, no sale (second chance)

**Condition:** listing ACTIVE, no order, `createdAt < 48h ago`, Nudge 1 already fired

**Push copy (only sent if score is Weak or Fair):**
> **"[Brand] voucher still available — time to reprice"**  
> "It's been 2 days. Drop to [suggested selling price] (=[suggested]% off) and it will likely sell today. [Reprice →]"

No push if score is Good or Hot (the listing is correctly priced — wait longer).

---

### Nudge 3 — Views but no sale (behaviour-triggered)

**Condition:** listing has ≥ 5 views (via view counter), no order, score is Weak or Fair

**Push copy:**
> **"[X] people viewed your [Brand] voucher"**  
> "They looked but didn't buy — usually means the price isn't quite right. Drop to [suggested price] to convert the next viewer. [Reprice →]"

This is the most powerful nudge because it uses social proof against the seller ("people are interested, you're just priced wrong").

---

### Nudge 4 — Competitor undercuts (market signal)

**Condition:** a new ACTIVE listing for the same brand goes live at a higher discount than this seller's listing

**Push copy:**
> **"A new [Brand] voucher just listed at [competitor]% off"**  
> "Yours is at [your]% off. Buyers will see both — reprice to stay competitive. [Reprice →]"

**Rule:** only fire this once per listing per day. Don't spam the seller every time a new competitor lists.

---

## 4. Expiry Countdown Funnel

This is the most important seller retention mechanic. Loss aversion is the strongest trigger in consumer psychology — "you're about to lose ₹850" is more motivating than "you could earn ₹850".

Each stage fires once per listing.

### Stage 1 — 7 days before expiry

**Condition:** ACTIVE listing, no order, `expiryDate - now = 7 days`

**Push copy:**
> **"[Brand] voucher expires in 7 days"**  
> "At current price, average sell time is [X] days — you have time, but don't wait too long. [Check listing →]"

If score is Weak or Fair, append:
> "Tip: price at [suggested]% off to sell it comfortably before expiry."

---

### Stage 2 — 3 days before expiry

**Condition:** ACTIVE listing, no order, `expiryDate - now = 3 days`

**Push copy:**
> **"3 days left on your [Brand] voucher ⚠️"**  
> "Drop to [suggested selling price] ([suggested]% off) and sell it before it expires worthless. [Reprice now →]"

**Tone shift:** stop being polite. Frame it as loss.

---

### Stage 3 — 24 hours before expiry

**Condition:** ACTIVE listing, no order, `expiryDate - now = 24h`

**Push copy:**
> **"Your [Brand] voucher expires TOMORROW"**  
> "You could still get [current selling price] in your account tonight. Drop the price — even [face value × 0.80] is better than nothing. [Reprice →]"

The suggested floor is `face value × 0.80` — even a small margin is better than zero. This anchors the seller to "something vs nothing."

---

### Stage 4 — Day of expiry

**Condition:** ACTIVE listing, no order, `expiryDate = today`

**Push copy (morning, 8 AM):**
> **"Last chance — [Brand] voucher expires today"**  
> "Get anything for it before midnight. Set your price to [face value × 0.75] — that's still [face value × 0.25] in your pocket. [Reprice now →]"

**In-app (listings screen):** listing card gets a red pulsing border and "EXPIRES TODAY" badge. The card sits at the top of the live listings list regardless of creation order.

---

### Stage 5 — Expired without selling (recovery)

**Condition:** listing just moved to EXPIRED status (scheduler runs every 6 hours)

**Push copy:**
> **"Your [Brand] voucher expired unsold"**  
> "It happens. If you have similar vouchers, list them earlier and price at [brand avg]% off from the start. [List another →]"

**Tone:** empathetic, not accusatory. End with a forward action. Do not say "you lost money" — say "here's how to do better next time."

---

## 5. Sale Milestones — Keep the Loop Going

### On sale (listing.reserved)

This already fires as a push. Enhance the copy and add a follow-up.

**Current copy:** (generic)  
**New copy:**
> **"Your [Brand] voucher sold! 🎉"**  
> "[Buyer name first name] just bought it. ₹[sellerPayout] is on its way to your account."

**Follow-up in-app (listings screen, shown once after sale):**
> "Nice one. Got more unused vouchers? [List another →]"

---

### On payout completed (payment.payoutStatus = COMPLETED)

Currently no push. Add one.

**Push copy:**
> **"₹[amount] just landed in your [UPI ID]"**  
> "Your Vouchrex payout is complete. List more and keep earning. [Sell another →]"

---

### Earnings milestone (seller cumulative)

Fire once when seller crosses ₹500, ₹2,000, ₹5,000, ₹10,000 in total payouts.

**Push copy (₹500 milestone):**
> **"You've earned ₹500 on Vouchrex 🏆"**  
> "That's real cash from vouchers you weren't using. Keep going — your next listing could earn you ₹[avg payout for their typical brand]."

---

## 6. Dormant Seller Re-engagement

### No listing in 14 days

**Condition:** user has sold at least one listing before, last listing was > 14 days ago

**Push copy:**
> **"It's been a while — got any unused vouchers?"**  
> "Your last sale earned you ₹[last payout amount]. Sellers who list every 2 weeks earn 4× more. [List now →]"

Anchor to their *own past earnings*, not a generic stat.

---

### No listing in 30 days (stronger nudge)

**Condition:** same, but 30 days

**Push copy:**
> **"[Name], you're leaving money on the table"**  
> "Unused vouchers in your inbox are worth cash. Takes 5 minutes to list. [Sell a voucher →]"

Personal address, direct loss framing.

---

## 7. Seller Onboarding Tips (First-Time Seller Series)

Three in-app banners shown on the listings screen for the first 3 days after a seller's first listing. Dismissible. Not push — too early to push a brand-new seller.

**Day 0 (after first listing):**
> "Tip: Vouchers priced at 15%+ off sell 3× faster. Check your discount on the listing."

**Day 1 (if no sale yet):**
> "Tip: Add redemption terms in the notes field — buyers trust listings with clear terms more."

**Day 2 (if no sale yet):**
> "Tip: The best time to sell food vouchers is 5–7 PM when buyers are thinking about dinner."

---

## 8. In-App Listings Screen Changes

Beyond notifications, the listings screen itself needs to surface seller health at a glance.

### Listing card states

Each listing card on the seller's listings screen gets a status indicator:

| State | Visual | Copy |
|---|---|---|
| Selling well (Good/Hot price, < 24h old) | Green dot | "Live — priced to sell" |
| Needs attention (Weak/Fair price, > 24h) | Amber dot | "Tap to reprice" |
| Expiry < 7 days | Amber border | "Expires [date] — reprice?" |
| Expiry < 48h | Red border | "Expires soon — act now" |
| Expiry today | Red pulsing border | "EXPIRES TODAY" |
| Has views, no sale | Amber dot + eye icon | "[X] views — reprice to convert" |

### Earnings strip (top of listings screen)

```
You've earned ₹4,200 total · 3 vouchers sold
```

Tapping it shows a breakdown by brand and month. Simple, motivating.

---

## 9. Notification Rules

To avoid burning notification trust, these rules apply across all seller nudges:

| Rule | Detail |
|---|---|
| **Max 1 nudge per listing per day** | No matter how many conditions are true simultaneously, only the highest-priority nudge fires |
| **Expiry stages don't repeat** | Each stage (7d, 3d, 24h, day-of) fires exactly once per listing |
| **Competitor alert max 1/day** | Even if 5 competitors list the same day, send at most 1 competitive alert per listing per day |
| **Dormant re-engagement cap** | Max 2 dormant nudges (14d + 30d). After that, stop — repeated pushes to truly dormant users degrade deliverability |
| **Priority order** | Expiry day > Expiry 24h > Expiry 3d > Views nudge > Competitor alert > Health nudge |
| **No push between 10 PM – 8 AM** | Respect quiet hours. Nudges that would fire in this window are held until 8 AM |

---

## 10. Post-Expiry Recovery

When a listing expires unsold, the seller is at their lowest point of trust in the platform. This is the highest-risk moment for permanent churn. The recovery flow has one goal: **get them to relist before they give up**.

---

### The Critical Distinction

An expired *listing* is not the same as an expired *voucher code*. The listing expiry date is set by the seller — they may have set it conservatively, or the code may have a later real-world expiry. The voucher code might still work perfectly well. The seller just failed to sell it in time on the platform.

This distinction must be communicated clearly. Do not say "your voucher expired." Say "your **listing** expired."

---

### Post-Expiry Push (fires when scheduler marks listing EXPIRED)

**Push copy:**
> **"Your [Brand] listing expired — the code might still be valid"**  
> "Listings expire but voucher codes often don't. If yours is still valid, relist it now — this time at [brand avg + 5]% off and it'll sell fast. [Relist →]"

**Tone rules:**
- Never say "you lost money" or "it expired worthless"
- Always offer a forward path (relist)
- Frame the suggested discount as higher than their previous attempt so the relist actually succeeds
- If brand avg discount is, say, 15%, suggest 20% for the relist — give them a reason to believe it will work this time

---

### The Relist Flow

Currently there is no relist mechanic. A seller with an expired listing has to start the sell flow from scratch, re-enter the brand, re-enter the code, re-enter everything. This friction causes drop-off.

**What relist should do:**

1. On the history tab, expired listing cards get a **"Relist"** button alongside the existing detail view
2. Tapping "Relist" opens the sell flow pre-filled with:
   - Brand name (locked, not editable)
   - Voucher type (pre-filled, editable)
   - Code (pre-filled from vault — seller just needs to confirm it still works)
   - Expiry date (blank — seller must re-enter; prompt: "Enter the real expiry date on the voucher")
   - Suggested selling price pre-filled at `faceValue × (1 - (brand avg + 5) / 100)`
3. Step 1 of the sell flow shows a banner:
   > "Relisting [Brand]. Enter the actual expiry date on the voucher and we'll handle the rest."

**Why this matters:** the code is already in the vault encrypted. A relist should reuse it — no re-entry. The seller just confirms validity and sets a new expiry and price.

---

### Demand Signal on Expiry

If there are active watchlist alerts (`BrandAlert`) for the same brand at the moment of expiry, the push copy changes:

**Push copy (with demand):**
> **"Your [Brand] listing expired — but [X] buyers are waiting"**  
> "[X] people have alerts set for [Brand] vouchers. Relist yours now and it could sell within the hour. [Relist →]"

This is the most powerful version of the recovery push. It converts a failure moment into urgency. The seller went from "I failed to sell it" to "there are buyers ready right now."

**Condition:** `BrandAlert` count for this `brandId` with `active = true` ≥ 1

---

### What the History Tab Shows for Expired Listings

Currently expired listings sit in the history tab with no action possible. They should show:

```
┌──────────────────────────────────────────┐
│  EXPIRED          Swiggy                 │
│  ₹850 · 15% off · Expired 17 May        │
│                                          │
│  [View Details]        [Relist →]        │
└──────────────────────────────────────────┘
```

The "Relist →" button is only shown if `expiryDate` was within the last **30 days** — after that the voucher code is almost certainly dead and relisting would waste the seller's time and damage buyer trust.

---

### Expiry Analytics Banner (Listings Screen)

If a seller has had 2+ expired unsold listings in the last 60 days, show a persistent dismissible banner at the top of the listings screen:

```
⚠  2 of your recent listings expired without selling.
   Vouchers priced at 15%+ off sell before expiry 94% of the time.
   [See pricing tips →]
```

The "pricing tips" link opens a simple in-app explainer (not an external URL) covering:
- How to pick the right discount
- How to set the expiry date correctly (use the actual date on the voucher, not an earlier one)
- When to relist vs. let it go

This educates repeat-failure sellers before they churn, without being condescending about a single failure.

---

### When NOT to Offer Relist

Do not show the relist button or push recovery if:

| Condition | Reason |
|---|---|
| Listing expiry was > 30 days ago | Code is almost certainly dead by now |
| The brand is a food delivery promo code (not gift card) | Promo codes typically expire on a fixed date and can't be extended |
| Seller has a BLOCKED trust tier | Platform should not help blocked sellers re-list |

---

## 11. Summary — What Fires When

```
Listing created
  └─ In-app: post-listing confirmation (immediate)
  
T+24h, no sale
  └─ Push: health nudge (copy based on discount score)
  
T+48h, no sale, Weak/Fair price
  └─ Push: second chance reprice nudge

≥ 5 views, no sale, Weak/Fair price  
  └─ Push: "X people viewed — reprice to convert"

New competitor at better discount
  └─ Push: competitive alert (max 1/day per listing)

7 days before expiry
  └─ Push: soft expiry warning + pricing tip

3 days before expiry
  └─ Push: urgent reprice prompt (loss framing begins)

24 hours before expiry
  └─ Push: hard urgency — "get something rather than nothing"

Day of expiry (8 AM)
  └─ Push: last chance — floor price suggestion
  └─ In-app: listing card turns red + "EXPIRES TODAY"

Listing expires unsold
  └─ Push: empathetic recovery + forward CTA
  └─ In-app: history card shows "Relist" button
  └─ If demand exists (watchlist alerts for this brand): "X buyers are waiting — relist now"

Listing sells (listing.reserved)
  └─ Push: sale celebration + payout preview

Payout completed
  └─ Push: "₹X landed in your account" + list again CTA

Cumulative earnings milestone (₹500, ₹2k, ₹5k, ₹10k)
  └─ Push: earnings celebration

14 days no listing (has sold before)
  └─ Push: re-engagement anchored to last payout

30 days no listing
  └─ Push: direct loss-framing re-engagement
```

---

## 12. Implementation Status & Build Order

### Already shipped (Phase 1 & 2)

| Feature | Where |
|---|---|
| Post-listing confirmation screen (brand name, sell time estimate, notify line) | `sell.tsx` |
| Live pricing status ("Priced to sell" / "Great deal") | `sell.tsx` |
| Pricing intelligence banner with suggested price autofill | `sell.tsx` |
| Earnings summary strip (`user.totalEarned`) | `listings.tsx` |
| Expiry nudge with one-tap reprice (< 72h) | `listings.tsx` |
| BrandAlert model, API, push trigger on new listing | `alerts.service.ts`, `listings.service.ts` |

### Phase 3 — Build order (highest ROI first)

**1. Demand Pulse** (sell screen, on brand select)  
New endpoint: `GET /alerts/count/:brandId` → `{ count: number }`.  
Show in sell.tsx when brand selected, if count ≥ 2:
> "🔥 {count} buyers are waiting for a {Brand} voucher right now"

Also update the post-listing success screen to include: "We just notified {count} buyers who were waiting for this."

**2. Expiry countdown scheduler** (backend)  
New `SellerNudgeScheduler` — runs every hour, checks listings against trigger windows:
- T+24h no sale → health nudge push (discount-score-based copy)
- T+48h no sale, Weak/Fair price → reprice push
- 7d before expiry → soft warning
- 3d before expiry → loss-framing push
- 24h before expiry → hard urgency push
- Day of expiry (8 AM) → last chance push
- Listing moves to EXPIRED → recovery push (check BrandAlert count for demand signal)

Each nudge writes a record to prevent repeat fires (use `Notification` table with `dedupeKey`).

**3. Relist flow** (mobile + backend)  
- Expired listing cards on history tab get a "Relist" button (only if `expiryDate` within last 30 days)  
- Tapping opens sell flow pre-filled: brand (locked), voucher type, code from vault, suggested price at `faceValue × (1 - (brandAvg + 5) / 100)`
- Step 1 shows banner: "Relisting {Brand}. Enter the actual expiry date on the voucher."

**4. Clipboard code pre-fill** (mobile)  
`expo-clipboard` is already in dependencies. On Sell tab focus, call `Clipboard.getStringAsync()`, check if result looks like a voucher code (alphanumeric, 8–20 chars, no spaces). If yes, show prompt and pre-fill the code field.

**5. Payout completed push + earnings milestones** (backend)  
Wire into `orders.service.ts` when `payoutStatus` transitions to `COMPLETED`. Check `user.totalEarned` against milestone thresholds (₹500, ₹2k, ₹5k, ₹10k) and fire milestone push if crossed.

**6. Dormant re-engagement** (scheduler)  
Add to `SellerNudgeScheduler`: check for sellers with `totalSales > 0` and no listing in last 14/30 days. Fire once per window. Cap at 2 total dormant nudges per user.

### Notification guardrails (apply to all above)

- Max 1 nudge per listing per day — highest priority wins
- Expiry stages fire exactly once per listing (use `dedupeKey`)
- No pushes between 10 PM – 8 AM (hold until 8 AM)
- Competitor alert max 1 per listing per day
- Dormant cap: 14d nudge + 30d nudge only, then stop
