
# Vouchrex — Complete Design System & Redesign Plan

## Context
Starting fresh from HLD. The user wants a proper design-first approach with both dark and light themes from the start. Previous attempts used saffron (now feels overused) and suffered from glassmorphism applied everywhere without contrast hierarchy. This plan establishes the design philosophy first, then defines the full token system, then maps it to every screen.

---

## UX Design Philosophy

**"Calm Confidence"** — Vouchrex is a trust-first escrow marketplace. The design must communicate:
- **Safety without sterility** — Not a cold bank, but not a flashy startup either
- **Clarity over cleverness** — Every screen answers: "What do I do next?"
- **State transparency** — Escrow status, verification timers, trust tiers always visible
- **Premium but accessible** — Like Jupiter Money: numbers as heroes, clean space, purposeful color

**Inspiration**: Jupiter Money (numbers as heroes) + Zerodha Kite (dark-first, information hierarchy) + CRED (bold confidence) — but lighter and more accessible for P2P marketplace

---

## Color System — "Vault" Palette

**Chosen: Deep Indigo + Electric Violet + Emerald**
- NOT saffron/orange (overused, reads as warning)
- NOT teal (already used in previous version, user wants fresh)
- Purple/Indigo = wealth, sophistication, premium (CRED approach)
- Emerald = growth, positive action, escrow released (money flowing)
- Violet accent = trust tier highlight, CTAs

### Light Theme
```
background:    #F8F7FF   (off-white with violet hint — not cold white)
surface:       #FFFFFF
surfaceRaised: #F3F1FF   (cards slightly violet-tinted)
surfaceTray:   #EDE9FE   (input fields, trays)

brand:         #5B21B6   (Deep Violet — primary)
brandBright:   #7C3AED   (Violet — interactive states)
brandSoft:     #EDE9FE   (Violet surface)

action:        #059669   (Emerald — CTA buttons, buy actions, escrow released)
actionBright:  #10B981   (Bright emerald — hover/active)
actionSoft:    #D1FAE5   (Emerald surface)

ink:           #1E1B4B   (Deep indigo-black — primary text)
inkSecondary:  #4338CA   (Indigo — secondary text, labels)
inkMuted:      #6B7280   (Gray — captions, placeholders)

border:        #DDD6FE   (Light violet border)
borderStrong:  #A78BFA   (Stronger violet border, focused states)

danger:        #DC2626
dangerSoft:    #FEE2E2
success:       #059669
successSoft:   #D1FAE5
warning:       #D97706
warningSoft:   #FEF3C7

gold:          #F59E0B   (Trust tier Gold badge)
silver:        #94A3B8   (Trust tier Silver badge)
bronze:        #B45309   (Trust tier Bronze badge)

shadow:        rgba(91, 33, 182, 0.08)
shadowStrong:  rgba(91, 33, 182, 0.16)
```

### Dark Theme
```
background:    #0D0B1E   (Deep space indigo — not pure black)
surface:       #13102B   (Slightly lighter — cards)
surfaceRaised: #1A1640   (Raised cards)
surfaceTray:   #221E4A   (Input fields, trays)

brand:         #A78BFA   (Violet lightened for dark bg)
brandBright:   #C4B5FD   (Bright violet on dark)
brandSoft:     #2E1F6B   (Soft brand tint)

action:        #10B981   (Emerald stays vivid on dark)
actionBright:  #34D399
actionSoft:    #064E3B   (Dark emerald surface)

ink:           #F5F3FF   (Near-white with violet hint)
inkSecondary:  #C4B5FD   (Light violet — secondary text)
inkMuted:      #9CA3AF   (Gray — captions)

border:        #2E2A5E   (Dark violet border)
borderStrong:  #4C3D8F   (Stronger dark border)

danger:        #F87171
dangerSoft:    #450A0A
success:       #34D399
successSoft:   #064E3B
warning:       #FCD34D
warningSoft:   #451A03

shadow:        rgba(0, 0, 0, 0.40)
shadowStrong:  rgba(0, 0, 0, 0.60)
```

---

## Typography
**IBM Plex Sans** — financial, trustworthy, professional
- Works on both iOS and Android with system font fallback
- Matches CRED/Jupiter Money premium feel

```
display:  32px / weight 700  (hero numbers, price, voucher value)
title:    22px / weight 700  (screen titles, card titles)
heading:  18px / weight 600  (section headers)
body:     15px / weight 400  (descriptions, copy)
label:    13px / weight 600  (field labels, eyebrows)
caption:  12px / weight 500  (meta, timestamps, pills)
mono:     16px               (voucher codes, amounts)
```

---

## Component Design Principles

### Buttons
- **Primary (action)**: Emerald solid — "Buy", "Continue", "Confirm", "Pay"
- **Brand (brand)**: Violet solid — "Sell", "Create Listing", "Submit"
- **Secondary**: Outlined (brandBright border + text) — "Change number", "Cancel"
- **Danger**: Red solid — "Raise dispute"
- **NO glass buttons** — buttons must always be clearly solid and tappable
- Disabled state: 35% opacity (clearly different from enabled)
- Minimum height: 56px, borderRadius: 16px

### Cards (TicketCard)
- Light: white surface + violet-tinted shadow + left accent bar (colored by tone)
- Dark: surfaceRaised + subtle border + same accent bar
- Accent bar color = tone indicator (emerald=success, violet=active, red=danger, gold=premium)
- NO full glassmorphism on cards — only subtle surface elevation

### Inputs
- Light: white bg + violet border on focus + label above
- Dark: surfaceTray + borderStrong on focus
- Clear placeholder text at 40% ink opacity
- Error state: red border + red helper text below

### Trust Tier Badges
- Gold: #F59E0B background, dark text — prominent on seller profiles
- Silver: #94A3B8 background
- Bronze: #B45309 background
- Always visible next to seller name

### Escrow Status Pills (unique to this app)
- PAYMENT_PENDING: warning yellow
- ESCROW_ACTIVE: brand violet (locked/secured)
- CODE_REVEALED: action emerald (active/ticking)
- CONFIRMED: success emerald
- DISPUTED: danger red

### Glassmorphism — Used Sparingly
- ONLY on: sign-in card overlaying the gradient background
- NEVER on: buttons, input fields, navigation items, content cards
- Rule: glass only when there's a rich colored background behind it

---

## Screen-by-Screen Design

### Sign-In
- Background: Dark gradient `#0D0B1E → #1A1640 → #2E1F6B` (deep space indigo)
- Two soft orbs: violet top-right (rgba 165,85,255,0.15), emerald bottom-left (rgba 16,185,129,0.10)
- Brand name: white, large
- Hero text: white
- Card: glass (BlurView 50) with `rgba(255,255,255,0.08)` frost + white border — works because bg is rich dark
- Inside card: ALL text white/light
- Button: **Emerald solid** (not glass) — unmistakably a button
- Trust pills: glass tone (uniform white-glass, same style)

### Bazaar (Browse)
- Background: `background` token (light: #F8F7FF, dark: #0D0B1E)
- Header card: surfaceRaised with violet left border accent
- Search bar: surfaceTray with violet focus ring
- Filter chips: idle = outlined, selected = brand violet solid
- TicketCard: white/surfaceRaised + left accent bar in violet
- Discount % badge: emerald (it's a positive number = save money)

### Sell
- Same background
- Brand select chips: violet selected
- Form: clean TextField components
- Discount preview pill: emerald (positive signal)
- CTA: Brand violet solid button ("Create Listing")

### Orders
- Status-based color coding:
  - Needs action: violet left bar + action pill
  - Disputed: red left bar
  - Settled/confirmed: emerald left bar
- Segment toggle: pill-style (Buying/Selling)
- Countdown timer: prominent, warm amber color

### Order Detail
- Hero status card: full-width, surface color changes by state
- Payment → escrow → reveal → confirm: clear step indicator
- Emerald CTA for positive actions (Confirm, Pay)
- Red CTA only for Dispute
- Voucher code revealed: monospace font, high contrast, violet bordered box

### Tab Bar
- Light: white, violet active icon + label, gray inactive
- Dark: surface color, bright violet active, muted inactive
- Floating pill design (same shape as now, bottom 14px)
- NO frosted glass — clean solid surface

---

## Files to Create/Modify

### 1. `src/theme/tokens.ts` — Full rewrite
- `lightTheme` and `darkTheme` objects
- All palette, spacing, radius, typography, shadows

### 2. `src/theme/ThemeContext.tsx` — New file
- React context for current theme
- `useTheme()` hook returning current theme tokens
- Persists user preference via expo-secure-store

### 3. All components — use `useTheme()` instead of direct palette import
- `primary-button.tsx`
- `ticket-card.tsx`
- `status-pill.tsx`
- `section-panel.tsx`
- `screen-shell.tsx`
- `text-field.tsx`
- `filter-chip.tsx`
- `keyline-row.tsx`
- `loading-screen.tsx`

### 4. All screens
- `sign-in.tsx`
- `(tabs)/bazaar.tsx`
- `(tabs)/sell.tsx`
- `(tabs)/orders.tsx`
- `(tabs)/inbox.tsx`
- `(tabs)/_layout.tsx`
- `listings/[id].tsx`
- `orders/[id].tsx`

---

## Implementation Order
1. `tokens.ts` — define both themes
2. `ThemeContext.tsx` — useTheme hook
3. `_layout.tsx` — wrap with ThemeProvider
4. `sign-in.tsx` — first visible screen, validate design
5. All components (8 files)
6. All tab screens (4 files)
7. Detail screens (2 files)

---

## Verification
1. `npx expo start --ios` — sign-in renders with new palette
2. Toggle theme in inbox screen — all colors update instantly
3. All buttons solid (no invisible glass buttons)
4. Disabled button visually distinct (35% opacity)
5. Escrow status pills clearly colored per state
6. `yarn typecheck` passes
