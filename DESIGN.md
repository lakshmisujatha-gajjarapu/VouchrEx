# DESIGN.md — Vouchrex

> Agent-friendly design system file for use with Google Stitch, Claude Code, Gemini CLI, Cursor, and other AI coding assistants.
> Import this file into Stitch to restore the full design system instantly.

---

## Product

**Vouchrex** is a P2P voucher and coupon resale marketplace for India. The mobile app is built with Expo React Native (Expo Router). The aesthetic is modern, trustworthy, and slightly premium — using deep violet/indigo as the brand identity with emerald green as the action/CTA colour.

---

## Colour Palette

### Light Mode

| Token | Hex | Usage |
|---|---|---|
| `background` | `#F8F7FF` | Page / screen background |
| `surface` | `#FFFFFF` | Cards, modals, bottom sheets |
| `surfaceRaised` | `#F3F1FF` | Elevated surfaces, pressed states |
| `surfaceTray` | `#EDE9FE` | Trays, tags, disabled button bg |
| `brand` | `#5B21B6` | Primary brand (deep violet) |
| `brandBright` | `#7C3AED` | Brand CTA, button fill |
| `brandSoft` | `#EDE9FE` | Brand tinted background, chips |
| `action` | `#059669` | Success / buy / confirm CTA (emerald) |
| `actionBright` | `#10B981` | Action button fill |
| `actionSoft` | `#D1FAE5` | Action tinted background |
| `ink` | `#1E1B4B` | Primary text |
| `inkSecondary` | `#4338CA` | Secondary labels, links |
| `inkMuted` | `#6B7280` | Placeholder, captions, metadata |
| `border` | `#DDD6FE` | Default border |
| `borderStrong` | `#A78BFA` | Focused/active border |
| `danger` | `#DC2626` | Errors, destructive actions |
| `dangerSoft` | `#FEE2E2` | Error tinted background |
| `success` | `#059669` | Confirmed, verified states |
| `successSoft` | `#D1FAE5` | Success tinted background |
| `warning` | `#D97706` | Escrow timer, caution |
| `warningSoft` | `#FEF3C7` | Warning tinted background |
| `gold` | `#F59E0B` | Premium badge, trust badge |
| `silver` | `#94A3B8` | Secondary badges |
| `bronze` | `#B45309` | Tertiary badges |
| `shadow` | `rgba(91,33,182,0.08)` | Default drop shadow colour |
| `shadowStrong` | `rgba(91,33,182,0.16)` | Elevated shadow |
| `glassSurface` | `rgba(255,255,255,0.08)` | Frosted glass card bg |
| `glassBorder` | `rgba(255,255,255,0.18)` | Frosted glass border |
| `countdown` | `#D97706` | Timer / countdown label |
| `countdownSoft` | `#FEF3C7` | Timer background |

### Dark Mode overrides

| Token | Hex |
|---|---|
| `background` | `#0D0B1E` |
| `surface` | `#13102B` |
| `surfaceRaised` | `#1A1640` |
| `surfaceTray` | `#221E4A` |
| `brand` | `#A78BFA` |
| `brandBright` | `#C4B5FD` |
| `brandSoft` | `#2E1F6B` |
| `action` | `#10B981` |
| `actionBright` | `#34D399` |
| `actionSoft` | `#064E3B` |
| `ink` | `#F5F3FF` |
| `inkSecondary` | `#C4B5FD` |
| `inkMuted` | `#9CA3AF` |
| `border` | `#2E2A5E` |
| `borderStrong` | `#4C3D8F` |
| `danger` | `#F87171` |
| `dangerSoft` | `#450A0A` |
| `success` | `#34D399` |
| `successSoft` | `#064E3B` |
| `warning` | `#FCD34D` |
| `warningSoft` | `#451A03` |
| `shadow` | `rgba(0,0,0,0.40)` |
| `shadowStrong` | `rgba(0,0,0,0.60)` |

---

## Typography

### Font Families

| Role | Family | Weight |
|---|---|---|
| `display` | IBM Plex Sans | 700 Bold |
| `ui` | IBM Plex Sans | 400 Regular |
| `mono` | IBM Plex Sans | 600 SemiBold |

### Font Size Scale

| Token | px | Usage |
|---|---|---|
| `display` | 32 | Hero / splash headings |
| `title` | 22 | Screen titles (not used in ScreenShell — uses 26px) |
| `heading` | 18 | Card headings |
| `body` | 15 | Body copy |
| `label` | 13 | Labels, captions |
| `caption` | 12 | Metadata, pills, chips |
| `mono` | 16 | Voucher codes, monospaced content |

### Type Styles in Practice

- **Screen title**: `font-display`, 26px, bold, `lineHeight: 30`, color `ink`
- **Eyebrow label**: `font-ui`, 12px, extrabold, uppercase, `letterSpacing: 0.6`, color `brand`
- **Card heading**: `font-display`, 18px, bold, `lineHeight: 22`, color `ink`
- **Body**: 14–15px, regular, `lineHeight: 20`, color `inkMuted`
- **Pill / Chip**: `font-ui`, 12px, bold/extrabold, `letterSpacing: 0.2–0.4`, uppercase for chips
- **Tab bar label**: `font-ui`, 10px, semibold (600), `letterSpacing: 0`

---

## Spacing Scale

| Token | px |
|---|---|
| `1` | 4 |
| `2` | 8 |
| `3` | 12 |
| `4` | 16 |
| `5` | 20 |
| `6` | 24 |
| `7` | 28 |
| `8` | 32 |

> Default screen horizontal padding: **20px**. Default gap between sections: **12px** (gap-3).

---

## Border Radius Scale

| Token | px | Usage |
|---|---|---|
| `sm` | 12 | Small chips, inputs |
| `md` | 18 | Cards, panels |
| `lg` | 24 | Large cards, modals |
| `xl` | 30 | Full-width bottom sheet handles |
| `pill` | 999 | Pills, chips, filter tags |

> In Tailwind/NativeWind aliases: `rounded-app-sm` = 12, `rounded-app-md` = 18, `rounded-app-lg` = 24, `rounded-pill` = 999.

---

## Elevation / Shadow

| Level | Usage | shadowOffset | shadowOpacity | shadowRadius | elevation |
|---|---|---|---|---|---|
| Card (default) | TicketCard, SectionPanel | `{w:0, h:4}` | 0.06 | 12 | 1 |
| Button (action/brand) | PrimaryButton CTA | `{w:0, h:10}` | 0.28 | 20 | 5 |
| Button (secondary) | PrimaryButton secondary | `{w:0, h:10}` | 0.12 | 16 | 2 |
| Floating nav bar | FloatingTabBar | `{w:0, h:8}` | 1 | 24 | 8 |

Shadow colour is always `shadow` or `shadowStrong` from the theme.

---

## Components

### `ScreenShell`

Full-screen layout wrapper. Structure:
```
SafeAreaView (top, left, right)
  ├── [Optional] ScrollView
  │     └── View (px-5, pt-2, pb-100 or pb-8 with footer)
  │           ├── Eyebrow label (optional)
  │           ├── Title (26px bold)
  │           ├── [Optional] Close button (Ionicons "close", 26px)
  │           ├── Subtitle (optional, 13px muted)
  │           └── {children}
  └── [Optional] Footer SafeAreaView (surface bg, border-top, px-20 py-12)
```
- Background: `background` colour
- Footer sits outside the scroll, pinned to bottom safe area

---

### `PrimaryButton`

Full-width `Pressable` → `View` with centred `Text`.

| Tone | Background | Border | Text |
|---|---|---|---|
| `action` (default) | `actionBright` | `actionBright` | white |
| `brand` | `brandBright` | `brandBright` | white |
| `secondary` | `brandSoft` | `brandBright` | `brand` |
| `danger` | `danger` | `danger` | white |
| disabled | `surfaceTray` | `border` | `inkMuted` |

- Min height: **56px**, border radius: **16px**, border width: **1.5px**
- Text: 16px, weight 700, letterSpacing 0.1
- Press: opacity 0.88, scale 0.985
- Loading: shows `ActivityIndicator`, opacity 0.6

---

### `TicketCard`

Horizontal card with a left accent stripe.

Structure:
```
View (rounded-app-lg, border, overflow hidden)
  ├── View (w-1, full height) ← accent stripe colour
  └── View (flex-1, px-4, py-3, gap-1)
        ├── Row: Eyebrow label | Meta text (right aligned)
        ├── Title (heading, bold)
        ├── Subtitle (14px, muted)
        └── {children}
```

| Tone | Background | Border | Accent |
|---|---|---|---|
| `neutral` / `sand` | `surface` | `border` | `border` |
| `brand` / `ink` | `brandSoft` | `pillBrandBorder` | `brand` |
| `success` / `mint` | `successSoft` | `pillSuccessBorder` | `success` |
| `danger` | `dangerSoft` | `pillDangerBorder` | `danger` |
| `warning` | `warningSoft` | `pillWarnBorder` | `warning` |
| `premium` | `surface` | `gold` | `gold` |

Shadow: `{w:0, h:4}`, opacity 0.06, radius 12, elevation 1.

---

### `StatusPill`

Small rounded badge. `self-start rounded-pill border px-3 py-[5px]`.

| Tone | Background | Border | Text |
|---|---|---|---|
| `neutral` | `surfaceRaised` | `border` | `inkMuted` |
| `brand` / `trust` | `brandSoft` | `pillBrandBorder` | `brand` |
| `success` | `successSoft` | `pillSuccessBorder` | `success` |
| `danger` | `dangerSoft` | `pillDangerBorder` | `danger` |
| `warning` | `warningSoft` | `pillWarnBorder` | `warning` |
| `glass` | `rgba(255,255,255,0.08)` | `rgba(255,255,255,0.18)` | `rgba(255,255,255,0.84)` |

Text: `font-ui`, 12px, bold, letterSpacing 0.2.

---

### `FilterChip`

Horizontal scrollable filter tag. `rounded-pill border px-3 py-2`.

- **Selected**: bg `brandSoft`, border `brandBright`, dot `brand`, text `brand`
- **Unselected**: bg transparent, border `border`, dot `borderStrong`, text `inkMuted`
- Dot: 7px circle
- Text: `font-ui`, 12px, extrabold, uppercase, letterSpacing 0.3

---

### `FloatingTabBar`

Positioned absolutely, 14px from screen edges, bottom safe area.

```
View (position: absolute, left:14, right:14, bottom: max(safeBottom,14))
  height: 64, borderRadius: 20
  bg: surface, shadow: brand shadow offset {w:0, h:8}, radius 24, elevation 8
  └── 5× Pressable (flex-1, center)
        ├── Ionicons icon (22px)
        └── Label (10px, 600, font-ui)
```

Active tab: icon and label use `brand` colour. Inactive: `inkMuted`.

Tabs: Bazaar (search), Listings (albums), Sell (pricetag), Orders (receipt), Inbox (notifications).

> Note: FloatingTabBar only renders on non-tab pathnames (detail screens). Native tab screens use the system tab bar.

---

## Interaction Patterns

| Interaction | Value |
|---|---|
| Press opacity | 0.88 (buttons), 0.92 (cards), 0.6 (icon buttons) |
| Press scale | 0.985 (primary button) |
| Loading opacity | 0.6 |
| Disabled opacity | N/A — visual style change (muted bg/border/text) |

---

## App Navigation Structure

```
/ (root layout — AuthContext)
├── sign-in                  ← OTP sign-in screen
└── (tabs)/ (bottom tab navigator)
      ├── bazaar             ← Marketplace browse + search
      ├── listings           ← My active listings
      ├── sell               ← Create listing form
      ├── orders             ← My orders
      └── inbox              ← Notifications
          listings/[id]      ← Listing detail + buy
          listings/edit/[id] ← Edit listing
          orders/[id]        ← Order detail (reveal, confirm, dispute)
```

---

## Key UX Flows

### 1. OTP Sign-in
`sign-in.tsx` → enter mobile number → request OTP → enter 6-digit code → session token stored → redirect to `/(tabs)/bazaar`

### 2. Browse & Buy
`bazaar` → `listings/[id]` → tap Buy → Razorpay checkout → payment verified → order created → escrow active

### 3. Reveal Voucher Code
`orders/[id]` → tap Reveal → API decrypts CodeVault → returns watermarked SVG → display code → tap Confirm or raise Dispute

### 4. Sell a Voucher
`(tabs)/sell` → select brand → enter code + face value + price → set expiry → submit → listing created

---

## Design Principles

1. **Trust first** — voucher marketplaces live or die by trust. Every status (verified, disputed, escrow) must be visually unambiguous.
2. **Ticket metaphor** — cards use a left accent stripe like a physical ticket stub. Tone maps directly to order/listing state.
3. **Indian context** — currency in ₹, phone-first OTP auth, brand catalog-led browsing.
4. **Emerald = action** — the green CTA is reserved exclusively for "buy", "confirm", and "pay" — never decorative.
5. **Violet = identity** — deep violet is the brand; lighter violet is the UI chrome (borders, chips, secondary text).
6. **Light & dark parity** — every colour has a dark-mode counterpart; never use hardcoded hex in components.

---

## Stack

| Layer | Technology |
|---|---|
| Mobile | Expo (SDK 52+), Expo Router, React Native |
| Styling | NativeWind (Tailwind for RN) + inline StyleSheet |
| Theme | Custom `ThemeContext` + `tokens.ts` (light/dark) |
| Icons | `@expo/vector-icons` — Ionicons |
| Fonts | IBM Plex Sans (400, 600, 700) via expo-font |
| Backend | NestJS (port 3010), Prisma, PostgreSQL 16 |
| Auth | OTP → `x-session-token` header |

---

## File Locations

| What | Path |
|---|---|
| Colour tokens | `apps/mobile/src/theme/tokens.ts` |
| Theme context | `apps/mobile/src/theme/ThemeContext.tsx` |
| Primary button | `apps/mobile/src/components/primary-button.tsx` |
| Card component | `apps/mobile/src/components/ticket-card.tsx` |
| Status pill | `apps/mobile/src/components/status-pill.tsx` |
| Filter chip | `apps/mobile/src/components/filter-chip.tsx` |
| Screen shell | `apps/mobile/src/components/screen-shell.tsx` |
| Floating tab bar | `apps/mobile/src/components/floating-tab-bar.tsx` |
| HTTP client | `apps/mobile/src/lib/api.ts` |
| Auth hook | `apps/mobile/src/hooks/use-auth.tsx` |
