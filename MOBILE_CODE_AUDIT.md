# Mobile App Styling & Code Quality Audit

> Re-analyzed: 2026-04-15 | Every `.tsx` / `.ts` file in `apps/mobile/src/` audited

---

## Root Cause

`src/theme/tokens.ts` defines a complete design system — colors, spacing, typography, border radius — but the screens and many components were written without referencing it. The result: the token infrastructure is solid; the usage layer ignores it almost entirely.

---

## Available Theme Tokens (ground truth)

### Colors
`background`, `surface`, `surfaceRaised`, `surfaceTray`, `surfaceHigh`, `surfaceHighest`,
`brand`, `brandBright`, `brandSoft`, `action`, `actionBright`, `actionSoft`, `actionFixed`,
`ink`, `inkSecondary`, `inkMuted`, `border`, `borderStrong`,
`danger`, `dangerSoft`, `success`, `successSoft`, `warning`, `warningSoft`,
`gold`, `silver`, `bronze`, `glassSurface`, `glassBorder`,
`countdown`, `countdownSoft`, `pillBrandBorder`, `pillSuccessBorder`, `pillDangerBorder`, `pillWarnBorder`,
`shadow`, `shadowStrong`, `white`
— both light and dark variants

### Spacing
`{ 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32 }`

### Border Radius
`sm: 12`, `md: 18`, `lg: 24`, `xl: 30`, `pill: 999`

### Font Sizes
`display: 32`, `title: 22`, `heading: 18`, `body: 15`, `label: 13`, `caption: 12`, `mono: 16`

### Font Families
`headline` (Manrope 700), `headlineExtra` (Manrope 800), `body` (WorkSans 400),
`label` (WorkSans 500), `labelSemi` (WorkSans 600), `mono` (JetBrainsMono 500)

---

## 1. Hardcoded Colors

### 1.1 `app/sign-in.tsx` — CRITICAL (30+ instances)

| Line(s) | Value | Fix |
|---------|-------|-----|
| 24 | `GRADIENT = ['#0D0B1E', '#1A173D', '#2E1F6B']` | Move to theme gradient tokens |
| 95 | `rgba(167,139,250,0.15)` | `theme.colors.brandSoft` or gradient token |
| 107 | `rgba(52,211,153,0.08)` | `theme.colors.successSoft` |
| 125 | `color: '#D0BCFF'` | `theme.colors.brandBright` |
| 137 | `rgba(255,255,255,0.52)` | `theme.colors.inkMuted` |
| 141 | `rgba(255,255,255,0.72)` | `theme.colors.inkSecondary` |
| 152 | `'#F5F3FF'` | `theme.colors.ink` |
| 161 | `backgroundColor: '#A78BFA'` | `theme.colors.brand` |
| 182 | `color: '#F5F3FF'` | `theme.colors.ink` |
| 201 | `color: '#F5F3FF'` | `theme.colors.ink` |
| 242 | `backgroundColor: '#A78BFA'` | `theme.colors.brand` |
| 257 | `rgba(167,139,250,0.12)`, `rgba(167,139,250,0.25)` | `theme.colors.glassSurface`, `theme.colors.glassBorder` |
| 261 | `color: '#C4B5FD'` | `theme.colors.brandBright` |
| 278 | `rgba(248,113,113,0.28)`, `rgba(147,0,10,0.30)` | `theme.colors.dangerSoft` |
| 282 | `color: '#FFB4AB'` | `theme.colors.danger` |
| 309 | `rgba(255,255,255,0.44)` | `theme.colors.inkMuted` |
| 323 | `rgba(27,22,58,0.6)` | `theme.colors.glassSurface` |
| 325 | `rgba(255,255,255,0.08)` | `theme.colors.glassBorder` |
| 327 | `color="#A78BFA"` | `theme.colors.brand` |
| 331 | `rgba(255,255,255,0.5)` | `theme.colors.inkMuted` |
| 353 | `rgba(255,255,255,0.38)` | `theme.colors.inkMuted` |
| 368 | `rgba(255,255,255,0.18)` | `theme.colors.glassBorder` |

### 1.2 `app/listings/[id].tsx` — CRITICAL (15+ instances)

| Line(s) | Value | Fix |
|---------|-------|-----|
| 141 | `'#FFFFFF'` | `theme.colors.white` |
| 145, 181 | `shadowColor: '#000'` | `theme.colors.shadow` |
| 150 | `color: '#6E3ACA'` | `theme.colors.brand` |
| 180 | `colorScheme === 'dark' ? '#13102B' : theme.colors.surface` | Dark token missing — add to theme |
| 199 | `colorScheme === 'dark' ? '#783600' : '#FFDBC8'` | `theme.colors.warningSoft` |
| 201–202 | `colorScheme === 'dark' ? '#ffb68b' : '#552400'` | `theme.colors.warning` |
| 210 | `colorScheme === 'dark' ? '#3a268a' : theme.colors.brandSoft` | Dark token missing |
| 212–213 | `colorScheme === 'dark' ? '#68dba9' : theme.colors.brand` | `theme.colors.success` |
| 277 | `colorScheme === 'dark' ? '#28244c' : theme.colors.surfaceHigh` | Dark token missing |
| 315 | `colorScheme === 'dark' ? 'rgba(13,11,30,0.75)' : 'rgba(250,248,255,0.85)'` | `theme.colors.glassSurface` |
| 343 | `shadowColor: '#A78BFA'` | `theme.colors.brand` |
| 363 | `isOwnListing ? theme.colors.inkMuted : '#ffffff'` | `theme.colors.white` |
| 370 | `color="#ffffff"` | `theme.colors.white` |

### 1.3 `app/orders/[id].tsx` — CRITICAL (20+ instances)

| Line(s) | Value | Fix |
|---------|-------|-----|
| 396 | `colorScheme === 'dark' ? '#28244a' : theme.colors.surfaceHigh` | Dark token missing |
| 438 | `colorScheme === 'dark' ? 'rgba(26,22,53,0.5)' : 'transparent'` | `theme.colors.glassSurface` |
| 603 | `colorScheme === 'dark' ? '#1e1a3d' : theme.colors.surfaceRaised` | Dark token missing |
| 664 | `colorScheme === 'dark' ? 'rgba(13,11,30,0.80)' : 'rgba(250,248,255,0.85)'` | `theme.colors.glassSurface` |
| 709 | `rgba(0,0,0,0.5)` | `theme.colors.shadow` |

### 1.4 Components

| File | Line(s) | Value | Fix |
|------|---------|-------|-----|
| `components/reveal-code-button.tsx` | 6–7 | `GRADIENT: ['#A78BFA', '#D3BBFF']`, `FG = '#003B27'` | Move to gradient tokens |
| `components/reveal-code-button.tsx` | 29 | `shadowColor: '#A78BFA'` | `theme.colors.brand` |
| `components/primary-button.tsx` | 52 | `['#7C3AED','#8B5CF6','#9D77F5','#A78BFA']` | Gradient token |
| `components/primary-button.tsx` | 90 | Same fallback gradient | Gradient token |
| `components/primary-button.tsx` | 103 | `rgba(255,255,255,0.18)`, `rgba(255,255,255,0)` | `theme.colors.glassBorder` |
| `components/status-pill.tsx` | 18–20 | `rgba(255,255,255,0.08/0.18/0.84)` | `theme.colors.glassSurface/glassBorder/white` |
| `components/floating-tab-bar.tsx` | 68–74 | `rgba(13,11,30,0.65)`, `rgba(255,255,255,0.72)`, `rgba(204,195,214,0.40)` | `theme.colors.glassSurface/glassBorder` |
| `components/trust-badge.tsx` | 21 | `color: '#FFFFFF'` | `theme.colors.white` |
| `components/app-shell.tsx` | 104 | `` `${theme.colors.brand}40` `` | Add `brandGlow` token |
| `components/submerged-input.tsx` | 41 | `` `${theme.colors.brand}33` `` | Add `brandGlow` token |
| `components/date-field.tsx` | 130 | `rgba(0,0,0,0.40)` | `theme.colors.shadow` |
| `app/(tabs)/sell.tsx` | 407, 419 | `'#92400e'`, `'#991b1b'` | `theme.colors.warning`, `theme.colors.danger` |

---

## 2. Hardcoded Font Families & Sizes

Theme exposes `theme.fontFamily.*` and `theme.fontSize.*` — bypassed below.

| File | Line(s) | Value | Fix |
|------|---------|-------|-----|
| `components/primary-button.tsx` | 111, 132 | `'WorkSans_600SemiBold'`, `fontSize: 16` | `theme.fontFamily.labelSemi`, `theme.fontSize.mono` |
| `components/reveal-code-button.tsx` | 52 | `'Manrope_700Bold'`, `fontSize: 16`, `fontWeight: '700'` | `theme.fontFamily.headline`, `theme.fontSize.mono` |
| `app/sign-in.tsx` | 125 | `fontFamily: 'Manrope_800ExtraBold'`, `fontSize: 32`, `letterSpacing: -0.8`, `lineHeight: 36` | `theme.fontFamily.headlineExtra`, `theme.fontSize.display` |
| `app/sign-in.tsx` | 201 | `fontSize: 18`, `fontFamily: 'WorkSans_500Medium'` | `theme.fontSize.heading`, `theme.fontFamily.label` |
| `app/(tabs)/shop.tsx` | 78 | `fontSize: 56` | No token — add `hero` token or use `display` |
| `app/(tabs)/shop.tsx` | 164–171 | `fontSize: 15, 13, 18, 20, 24` scattered | `theme.fontSize.body/label/heading` |

---

## 3. Hardcoded Spacing & Dimensions

Theme spacing: `{ 1:4, 2:8, 3:12, 4:16, 5:20, 6:24, 7:28, 8:32 }`.

| File | Line(s) | Value | Fix |
|------|---------|-------|-----|
| `components/app-shell.tsx` | 39 | `paddingHorizontal: 20, paddingBottom: footer ? 8 : 100` | `theme.spacing[5]`, `theme.spacing[2]` |
| `components/app-shell.tsx` | 53 | `paddingTop: 16, paddingBottom: 10` | `theme.spacing[4]` |
| `components/screen-shell.tsx` | 106 | `paddingHorizontal: 20, paddingVertical: 12` | `theme.spacing[5]`, `theme.spacing[3]` |
| `components/date-field.tsx` | 150, 160 | `padding: 4` | `theme.spacing[1]` |
| `app/listings/[id].tsx` | 221, 232 | `padding: 16, borderRadius: 16` | `theme.spacing[4]`, `theme.radius.sm` |
| `app/orders/[id].tsx` | 438 | `padding: 24, paddingLeft: 28, gap: 16` | `theme.spacing[6]`, `theme.spacing[7]`, `theme.spacing[4]` |
| `app/(tabs)/shop.tsx` | 99 | `paddingHorizontal: 20, paddingTop: 8, gap: 16` | `theme.spacing[5]`, `theme.spacing[2]`, `theme.spacing[4]` |
| `app/(tabs)/shop.tsx` | 127 | `paddingHorizontal: 12` | `theme.spacing[3]` |
| `app/(tabs)/shop.tsx` | 161 | `paddingHorizontal: 10` | none (10 between tokens — add or use nearest) |
| `app/profile.tsx` | Throughout | `20, 15, 14, 16, 10, 28, 6, 12, 8, 4, 24, 48` | Map to spacing tokens |

---

## 4. Hardcoded Border Radius

Theme: `sm:12`, `md:18`, `lg:24`, `xl:30`, `pill:999`.

| File | Line(s) | Value | Fix |
|------|---------|-------|-----|
| `app/(tabs)/shop.tsx` | 100, 151, 194, 263, 285 | `borderRadius: 9999` (×5) | `theme.radius.pill` |
| `app/(tabs)/shop.tsx` | 236 | `borderRadius: 24` | `theme.radius.lg` |
| `app/(tabs)/shop.tsx` | 252 | `borderRadius: 14` | `theme.radius.sm` |
| `components/floating-tab-bar.tsx` | 44–55 | `borderRadius: 9999` | `theme.radius.pill` |
| `components/text-field.tsx` | 51 | `borderRadius: 14` | `theme.radius.sm` |
| `app/listings/[id].tsx` | 221 | `borderRadius: 16` | `theme.radius.sm` |

---

## 5. Magic Numbers (opacity, shadow, scale)

No named constants — inconsistent values across files.

| File | Line(s) | Value | Recommendation |
|------|---------|-------|----------------|
| `components/primary-button.tsx` | 76–80 | `shadowOpacity: 0.38/0.22/0.12`, `shadowRadius: 22/14/16`, `scale: 0.982` | Extract to a `buttonElevation` / `pressScale` constant |
| `app/(tabs)/shop.tsx` | 155 | `opacity: pressed ? 0.85 : 1` | |
| `app/(tabs)/shop.tsx` | 243 | `opacity: pressed ? 0.92 : 1` | Inconsistent with line 155 — pick one |
| `components/text-field.tsx` | 65 | `shadowOpacity: isFocused ? 0.15 : 0` | |
| `components/floating-tab-bar.tsx` | 50–54 | `shadowOpacity: 1, shadowRadius: 40, elevation: 12` | |

---

## 6. Duplicated Code

### 6.1 Button implementations
- `components/primary-button.tsx` and `components/reveal-code-button.tsx` — near-identical gradient + shadow + press-scale pattern. Should share base or be merged.

### 6.2 Chip rows in `app/(tabs)/shop.tsx`
- Lines 139–175 (sort chips) and 178–212 (category chips) — identical structure, copy-pasted. Extract `<HorizontalChipRow>`.

### 6.3 Status/color mapping
- `app/(tabs)/listings.tsx` lines 71–103: `getCardEyebrow()`, `getCardTone()`, `getStatusPillTone()`
- `app/orders/[id].tsx` lines 29–67: `cardToneForStatus()`, `escrowBadgeLabel()`, `escrowBadgeColors()`, `buildFlowSteps()`
- Same domain logic, different files. Consolidate into `src/lib/status.ts`.

### 6.4 Input component duplicated
- `components/text-field.tsx` — canonical
- `app/(tabs)/sell.tsx` lines 42–120 — `SubmergedInput` defined inline, duplicating text-field logic. Cannot be reused.

### 6.5 Error handler boilerplate
Same catch pattern in every screen — `sell.tsx` (169, 235), `listings.tsx` (328), `orders/[id].tsx` (143), and more. Extract a typed `extractError()` util.

### 6.6 Socket hooks
- `hooks/use-order-socket.ts` and `hooks/use-notifications-socket.ts` — near-identical event subscription pattern. Extract `useSocketEvents(namespace, handlers)`.

---

## 7. Missing Abstractions

### 7.1 `<AsyncView>` wrapper
Every screen manually manages:
```jsx
{loading && !data ? <ActivityIndicator /> : null}
{error ? <Text>{error}</Text> : null}
{data?.map(...)}
```
Files: `shop.tsx`, `sell.tsx`, `listings.tsx`, `inbox.tsx`, `orders/[id].tsx`. This is five copies of the same pattern.

### 7.2 `<ListingCard>` component
`app/(tabs)/shop.tsx` lines 230–310: ~80 lines of nested Views with hardcoded styles, rendered inline. No card component.

### 7.3 KYC status banner
`app/(tabs)/sell.tsx` lines 400–423: warning/error banner with hardcoded colors, defined inline. Should be `<StatusBanner tone variant>`.

---

## 8. Dark Mode Anti-Pattern

`listings/[id].tsx` and `orders/[id].tsx` read `useColorScheme()` and pass hardcoded dark-mode colors inline:

```ts
// Current — wrong
backgroundColor: colorScheme === 'dark' ? '#13102B' : theme.colors.surface

// Should be — use Unistyles theme which already handles dark/light
backgroundColor: theme.colors.surface
```

The dark values like `#13102B`, `#28244c`, `#1e1a3d` are just missing dark-mode entries in `tokens.ts`. Add them there; the screens should not know about color schemes.

---

## 9. Worst Offenders

| File | Lines | Severity | Primary Issues |
|------|-------|----------|----------------|
| `app/sign-in.tsx` | ~400 | **CRITICAL** | 30+ hardcoded hex/rgba, no extraction, duplicates theme gradient |
| `app/listings/[id].tsx` | ~380 | **CRITICAL** | 15+ hardcoded dark-mode colors, shadow colors, spacing |
| `app/orders/[id].tsx` | ~720 | **CRITICAL** | 20+ hardcoded colors, duplicated status logic, spacing magic numbers |
| `app/(tabs)/shop.tsx` | ~320 | **HIGH** | 40+ inline style objects, no card/chip extraction, `fontSize: 56` |
| `app/(tabs)/sell.tsx` | 626 | **HIGH** | Inline components, hardcoded KYC colors, 626-line file |
| `components/primary-button.tsx` | ~140 | **MEDIUM** | Hardcoded gradient, font family, magic opacity/scale |
| `components/reveal-code-button.tsx` | ~70 | **MEDIUM** | Hardcoded brand colors, duplicates primary-button |
| `app/(tabs)/listings.tsx` | ~340 | **MEDIUM** | Duplicated status mapping, inline DetailSheet |
| `components/floating-tab-bar.tsx` | ~90 | **MEDIUM** | Hardcoded dimensions, glass colors, magic shadow |
| `app/profile.tsx` | ~200 | **MEDIUM** | Hardcoded spacing throughout |
| `components/text-field.tsx` | ~90 | **LOW** | Hardcoded `borderRadius`, `minHeight` |
| `components/date-field.tsx` | ~170 | **LOW** | Hardcoded modal overlay rgba, padding |
| `components/trust-badge.tsx` | ~30 | **LOW** | Single hardcoded `#FFFFFF` |

---

## 10. Fix Priority Order

### Phase 1 — Token completeness (no screen changes needed)
1. Add missing dark-mode color values to `tokens.ts` so Unistyles resolves them — eliminates all `colorScheme === 'dark' ? '#...'` blocks
2. Add gradient tokens: `gradientBrand`, `gradientReveal`, `gradientSignIn`
3. Add `brandGlow` token (replaces `${brand}33` / `${brand}40` hex suffix hacks)

### Phase 2 — Components (isolated, low risk)
4. Extract `SubmergedInput` + `FieldLabel` from `sell.tsx` into `/components`
5. Extract `<ListingCard>` from `shop.tsx`
6. Extract `<HorizontalChipRow>` from `shop.tsx`
7. Extract `<StatusBanner>` from `sell.tsx`
8. Create `src/lib/status.ts` — consolidate all status→tone/label mappings

### Phase 3 — Screen cleanup (higher risk, do per screen)
9. `sign-in.tsx` — replace all hardcoded colors with tokens, extract OTP input section
10. `listings/[id].tsx` — remove `colorScheme` overrides, use theme tokens
11. `orders/[id].tsx` — same as above + fix spacing
12. `shop.tsx` — replace magic numbers, use `<ListingCard>` and `<HorizontalChipRow>`
13. `sell.tsx` — use extracted components, replace spacing numbers
14. `profile.tsx` — spacing pass

### Phase 4 — Global passes
15. Replace every `borderRadius: 9999` → `theme.radius.pill` (5 files)
16. Replace hardcoded spacing numbers with `theme.spacing[n]` (all files)
17. Replace hardcoded font families/sizes with `theme.fontFamily.*` / `theme.fontSize.*`
18. Unify press opacity across all Pressable components (pick `0.85` or `0.88`, use one constant)
