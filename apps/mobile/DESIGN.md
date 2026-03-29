# DESIGN.md — Vouchrex Mobile App

> Authoritative design system reference for the Expo React Native app.
> All token values are sourced from `src/theme/tokens.ts` — that file is the single source of truth.
> Use this document when building new screens, components, or asking an AI assistant to implement UI.

---

## 1. Creative North Star — "The Digital Vault"

Vouchrex is a P2P voucher resale marketplace for India. The mobile experience must feel **premium, secure, and trustworthy** — closer to a luxury-fintech product than a standard e-commerce app.

**Concept: Secure Fluidity.** Deep violet establishes brand authority. Emerald green signals safe, prosperous action. The two never compete — violet owns navigation and identity, emerald owns money and CTAs.

**The Ticket Metaphor.** Every voucher is treated as a physical ticket — layered, tangible, with a left-side accent stripe. Cards should feel like they have weight and depth, not flat rectangles.

**Intentional Asymmetry.** Large editorial-scale headlines (30–40px) may dominate up to 40% of the screen. Let type breathe. Generous vertical spacing (24–32px gutters) creates a high-fashion layout rather than a utilitarian grid.

---

## 2. Colour Tokens

Accessed in code via `useTheme()` from `src/theme/ThemeContext.tsx`. The returned object is typed as `AppTheme`.

### 2.1 Light Mode

| Token | Hex | Role |
|---|---|---|
| `colors.background` | `#FAF8FF` | Screen / page background |
| `colors.surface` | `#FFFFFF` | Cards, bottom sheets, modals |
| `colors.surfaceRaised` | `#F4F3FB` | Elevated bento cells, pressed states |
| `colors.surfaceTray` | `#EEEDF5` | Tray backgrounds, nav containers |
| `colors.surfaceHigh` | `#E8E7EF` | Input fields, unselected chips |
| `colors.surfaceHighest` | `#E2E2E9` | Strongest elevated surface |
| `colors.brand` | `#6E3ACA` | Brand violet — nav active, focus ring, links |
| `colors.brandBright` | `#8856E5` | Gradient start for CTAs and hero fills |
| `colors.brandSoft` | `#EBDDFF` | Brand-tinted chip bg, selected filter bg |
| `colors.action` | `#059669` | Emerald — success text, confirmed labels |
| `colors.actionBright` | `#10B981` | Emerald bright — gradient start for action CTA |
| `colors.actionSoft` | `#D1FAE5` | Action-tinted chip bg |
| `colors.actionFixed` | `#85F8C4` | **Accent stripe** on ticket cards (always fixed, never changes with theme) |
| `colors.ink` | `#1A1B21` | Primary body text |
| `colors.inkSecondary` | `#4A4453` | Secondary / supporting text |
| `colors.inkMuted` | `#7B7485` | Placeholders, captions, metadata |
| `colors.border` | `#CCC3D6` | Ghost borders (use at 15% opacity only) |
| `colors.borderStrong` | `#6E3ACA` | Focus state border |
| `colors.danger` | `#BA1A1A` | Errors, disputed state text |
| `colors.dangerSoft` | `#FFDAD6` | Error tinted background |
| `colors.success` | `#59CD9C` | Confirmed / verified label |
| `colors.successSoft` | `#D1FAE5` | Success tinted background |
| `colors.warning` | `#D97706` | Escrow timer, caution labels |
| `colors.warningSoft` | `#FEF3C7` | Warning tinted background |
| `colors.gold` | `#F59E0B` | Trust badge, premium indicator |
| `colors.silver` | `#94A3B8` | Secondary badge |
| `colors.bronze` | `#B45309` | Tertiary badge |
| `colors.shadow` | `rgba(26,27,33,0.04)` | Default ambient shadow colour |
| `colors.shadowStrong` | `rgba(26,27,33,0.10)` | Elevated shadow |
| `colors.glassSurface` | `rgba(255,255,255,0.08)` | Glassmorphic card background |
| `colors.glassBorder` | `rgba(255,255,255,0.18)` | Glassmorphic border |
| `colors.countdown` | `#D97706` | Escrow countdown timer |
| `colors.countdownSoft` | `#FEF3C7` | Timer background |
| `colors.white` | `#FFFFFF` | Fixed white (text on dark gradients) |

### 2.2 Dark Mode Overrides

| Token | Hex |
|---|---|
| `colors.background` | `#0D0B1E` |
| `colors.surface` | `#13102B` |
| `colors.surfaceRaised` | `#1A173D` |
| `colors.surfaceTray` | `#13102B` |
| `colors.surfaceHigh` | `#1C1935` |
| `colors.surfaceHighest` | `#272445` |
| `colors.brand` | `#A78BFA` |
| `colors.brandBright` | `#C4B5FD` |
| `colors.brandSoft` | `#4A3199` |
| `colors.action` | `#34D399` |
| `colors.actionBright` | `#34D399` |
| `colors.actionSoft` | `#064E3B` |
| `colors.actionFixed` | `#68DBA9` |
| `colors.ink` | `#E2E2E9` |
| `colors.inkSecondary` | `#C4C5D0` |
| `colors.inkMuted` | `#938F99` |
| `colors.border` | `#4A4453` |
| `colors.borderStrong` | `#938F99` |
| `colors.danger` | `#FFB4AB` |
| `colors.dangerSoft` | `#93000A` |
| `colors.success` | `#68DBA9` |
| `colors.successSoft` | `#064E3B` |
| `colors.warning` | `#FCD34D` |
| `colors.warningSoft` | `#451A03` |
| `colors.countdown` | `#FCD34D` |
| `colors.countdownSoft` | `#451A03` |
| `colors.shadow` | `rgba(0,0,0,0.30)` |
| `colors.shadowStrong` | `rgba(0,0,0,0.50)` |

### 2.3 Pill border tokens (status badge outlines)

| Token | Light | Dark |
|---|---|---|
| `pillBrandBorder` | `#C4B5FD` | `#4C3D8F` |
| `pillSuccessBorder` | `#6EE7B7` | `#065F46` |
| `pillDangerBorder` | `#FCA5A5` | `#7F1D1D` |
| `pillWarnBorder` | `#FDE68A` | `#78350F` |

---

## 3. Typography

Fonts are loaded in `app/_layout.tsx` via `expo-google-fonts`. Access via `fontFamily` tokens.

| Token | Font | Weight | Usage |
|---|---|---|---|
| `fontFamily.headline` | Manrope | 700 | Section headings, card titles |
| `fontFamily.headlineExtra` | Manrope | 800 | Hero headlines, primary editorial titles |
| `fontFamily.body` | Work Sans | 400 | Body copy, descriptions, dialog content |
| `fontFamily.label` | Work Sans | 500 | Tab labels, secondary UI text |
| `fontFamily.labelSemi` | Work Sans | 600 | Button labels, field labels, emphasis |
| `fontFamily.mono` | JetBrains Mono | 500 | Prices, voucher codes, IDs, amounts |

### Type Scale

| Token | Size | Usage |
|---|---|---|
| `fontSize.display` | 32px | Hero screen headline (sell screen, detail hero) |
| `fontSize.title` | 22px | Card title, modal headline |
| `fontSize.heading` | 18px | Section heading |
| `fontSize.body` | 15px | Standard body text |
| `fontSize.label` | 13px | Field labels, chips, tab bar labels |
| `fontSize.caption` | 12px | Timestamps, fine print, metadata |
| `fontSize.mono` | 16px | Prices, voucher codes |

### Typography Rules

- Headlines use `headlineExtra` (800) at `display` or `title` size with `letterSpacing: -0.03` to `-0.04`.
- Never use default system font. Always specify `fontFamily`.
- Prices are always `mono` font. Never render ₹ amounts in a sans-serif body font.
- Field labels are `labelSemi` (600), 13px, `textTransform: 'uppercase'`, `letterSpacing: 0.8`.
- Tab bar labels are `label` (500), 12px.

---

## 4. Spacing Scale

| Token | Value |
|---|---|
| `spacing[1]` | 4px |
| `spacing[2]` | 8px |
| `spacing[3]` | 12px |
| `spacing[4]` | 16px |
| `spacing[5]` | 20px |
| `spacing[6]` | 24px |
| `spacing[7]` | 28px |
| `spacing[8]` | 32px |

Screen horizontal padding is 20px (`spacing[5]`). Section gaps are 24px (`spacing[6]`). Card internal padding is 20px.

---

## 5. Border Radius Scale

| Token | Value | Usage |
|---|---|---|
| `radius.sm` | 12px | Small inputs, chips, tags |
| `radius.md` | 18px | Standard cards, bento cells |
| `radius.lg` | 24px | Large cards, sheets, modal containers |
| `radius.xl` | 30px | Hero cards, bottom sheet handles |
| `radius.pill` | 999px | Status pills, filter chips, tab bar |

---

## 6. Surface & Elevation Philosophy

### The No-Line Rule
**Never use visible 1px borders to separate content.** Layout boundaries are defined exclusively through background colour shifts between surface tiers.

- `background` → base canvas
- `surface` → cards, sheets that sit on background
- `surfaceRaised` → bento cells, secondary panels nested inside a card
- `surfaceHigh` → input fields, unselected filter chips
- `surfaceTray` → the floating tab bar container background

### Ambient Shadow Recipe
When an element must float (modals, FABs, the tab bar):
```
shadowColor: colors.shadow
shadowOffset: { width: 0, height: 0 }
shadowRadius: 40
shadowOpacity: 1
elevation: 8   // Android
```

For stronger floating (e.g. the buy footer on listing detail):
```
shadowColor: colors.shadowStrong
shadowRadius: 20
shadowOpacity: 1
```

### Ghost Border (Accessibility Only)
If a container must be defined for accessibility, use `border: colors.border` at **15% opacity**. Full-opacity borders are prohibited.

---

## 7. Components

### 7.1 SubmergedInput

The signature text input style. "Submerged" means the field background is `surfaceHigh` — it sits below the surrounding surface rather than appearing as a raised box.

```
height: 56px
borderRadius: radius.sm  (12px)
backgroundColor: colors.surfaceHigh
border: none (no border in rest state)
padding: horizontal 16px
fontFamily: fontFamily.body
fontSize: fontSize.body (15px)
color: colors.ink

// Focus state (via onFocus/onBlur handlers):
backgroundColor: colors.surface
border: 2px solid colors.brand    OR
boxShadow: 0 0 0 2px colors.brand
```

Props to always include: `autoCorrect={false}`, `spellCheck={false}`, `autoCapitalize="none"` for code/ID fields.

### 7.2 FieldLabel

```
fontFamily: fontFamily.labelSemi
fontSize: fontSize.label  (13px)
textTransform: 'uppercase'
letterSpacing: 0.8
color: colors.inkMuted
marginBottom: 8px
```

### 7.3 FilterChip

Scrollable horizontal chips for brand/category filtering.

```
// Unselected
backgroundColor: colors.surfaceHigh
borderRadius: radius.pill
paddingHorizontal: 14px
paddingVertical: 8px
fontFamily: fontFamily.labelSemi
fontSize: 13px
color: colors.inkMuted

// Selected
backgroundColor: colors.brandSoft
color: colors.brand
```

### 7.4 Ticket Card

The core marketplace element. Represents a voucher listing.

```
backgroundColor: colors.surface
borderRadius: radius.lg  (24px)
shadowColor: colors.shadow
shadowRadius: 40  shadowOpacity: 1

// Left accent stripe (always present)
position: 'absolute', left: 0, top: 16, bottom: 16
width: 6px
borderRadius on right side: 4px
backgroundColor: colors.actionFixed   // #85F8C4 light / #68DBA9 dark

// Dashed perforation line (separates header from footer)
borderStyle: 'dashed'
borderColor: colors.surfaceHigh
borderWidth: 1.5
```

Structure:
1. Brand avatar (40×40, `borderRadius: radius.sm`)
2. Brand name in `fontFamily.headline`, `fontSize.heading`
3. Seller name in `fontFamily.label`, `fontSize.caption`, `inkMuted`
4. Face value in `fontFamily.mono`, `fontSize.display`, `brand`
5. Your price in `fontFamily.mono`, `fontSize.title`, `ink`
6. Discount badge (if any): `brandSoft` bg, `brand` text

### 7.5 StatusPill / StatusBadge

```
borderRadius: radius.pill
paddingHorizontal: 10px
paddingVertical: 4px
fontFamily: fontFamily.labelSemi
fontSize: 11px
textTransform: 'uppercase'
letterSpacing: 0.6
```

Colour by status:

| Status | bg | text |
|---|---|---|
| ESCROW_ACTIVE | `warningSoft` | `warning` |
| CONFIRMED | `successSoft` | `success` |
| DISPUTED | `dangerSoft` | `danger` |
| CANCELLED | `surfaceHigh` | `inkMuted` |
| INITIATED | `brandSoft` | `brand` |

### 7.6 Primary CTA Button

```
height: 56px
borderRadius: radius.md  (18px)
background: LinearGradient 135° from brandBright (#8856E5) to brand (#6E3ACA)
fontFamily: fontFamily.labelSemi
fontSize: 16px
color: white
boxShadow: 0 10px 28px rgba(110,58,202,0.28)

// Disabled state: opacity 0.5
```

Action (emerald) variant:
```
background: LinearGradient 135° from actionBright (#10B981) to action (#059669)
boxShadow: 0 10px 28px rgba(5,150,105,0.25)
```

### 7.7 Floating Tab Bar

```
position: 'absolute', bottom: 14px
marginHorizontal: 14px
borderRadius: radius.pill
backgroundColor: glassSurface (rgba(255,255,255,0.08))
backdropFilter: blur(24px)   // use BlurView from expo-blur
shadowColor: colors.shadow
shadowRadius: 20
paddingHorizontal: 8px
paddingVertical: 10px

// Active tab icon: brand colour
// Inactive tab icon: inkMuted
// Active label: label font, 12px, brand colour
// Inactive label: label font, 12px, inkMuted
```

### 7.8 Brand Avatar

```
width: 48–80px (varies by context)
height: same
borderRadius: radius.sm or radius.md
backgroundColor: brandSoft
// Initial letter centred, headlineExtra, brand colour
```

### 7.9 Verified / Trust Badges

```
// TRUSTED SELLER badge
backgroundColor: #FFDBC8   paddingHorizontal: 10  paddingVertical: 4  borderRadius: pill
fontSize: 10px  fontFamily: labelSemi  textTransform: uppercase  letterSpacing: 0.6

// VERIFIED VOUCHER badge
backgroundColor: actionFixed  (same colour as accent stripe)
same sizing as above
```

---

## 8. UX Flows

| Flow | Key Screens | Notes |
|---|---|---|
| Auth | `sign-in.tsx` | Glassmorphic dark hero, OTP input, no back button |
| Browse | `(tabs)/index.tsx` | Bazaar tab, FilterChips, TicketCard list |
| Listing Detail | `listings/[id].tsx` | Full bleed image area, BlurView glassmorphic footer with buy CTA |
| Sell | `(tabs)/sell.tsx` | SubmergedInputs, brand search, 2-col grid for face/price |
| Order | `orders/[id].tsx` | Ticket card with reveal section, sticky confirm footer |

---

## 9. Design Rules (Do / Don't)

### Do
- Use `headlineExtra` (Manrope 800) for all hero headlines — never system font
- Use `fontFamily.mono` for every price, code, and ID
- Let the accent stripe (`actionFixed`) define the left edge of every ticket card
- Keep emerald for money/action, violet for brand/navigation — never swap them
- Use ambient shadow (shadowRadius 40, shadowOpacity 1) not hard drop shadows
- Use `contentContainerStyle={{ paddingBottom: 120 }}` on all scrollable screens to clear the floating tab bar

### Don't
- Don't use `border` with full opacity — use tonal shifts between surface levels instead
- Don't use system default fonts anywhere in the product
- Don't render prices in body font — always mono
- Don't use `borderStyle: 'solid'` for content separation — use `surfaceRaised`/`surfaceHigh` backgrounds
- Don't use `color: 'black'` or `color: '#000000'` — always use `colors.ink`
- Don't place active CTAs below the floating tab bar without `paddingBottom: 120`

---

## 10. Code Patterns

### Accessing tokens in a component
```tsx
import { useTheme } from '@/theme/ThemeContext';

export function MyComponent() {
  const { colors, spacing, radius, fontSize, fontFamily } = useTheme();
  // ...
}
```

### Gradient CTA button (expo-linear-gradient)
```tsx
import { LinearGradient } from 'expo-linear-gradient';

<LinearGradient
  colors={['#8856E5', '#6E3ACA']}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={{ height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center' }}
>
  <Text style={{ fontFamily: 'WorkSans_600SemiBold', fontSize: 16, color: '#FFFFFF' }}>
    Buy Now
  </Text>
</LinearGradient>
```

### Glassmorphic element (expo-blur)
```tsx
import { BlurView } from 'expo-blur';

<BlurView intensity={24} tint="dark"
  style={{ borderRadius: 999, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)' }}>
  {/* tab bar content */}
</BlurView>
```

### Ambient shadow card
```tsx
{
  backgroundColor: colors.surface,
  borderRadius: radius.lg,
  shadowColor: colors.shadow,
  shadowOffset: { width: 0, height: 0 },
  shadowRadius: 40,
  shadowOpacity: 1,
  elevation: 8,
}
```
