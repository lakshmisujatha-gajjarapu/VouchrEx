# DESIGN.md — Vouchrex Admin Console

> Authoritative design system reference for the Next.js admin app (`apps/admin`).
> All token values are sourced from `app/globals.css` `@theme` block — that file is the single source of truth.
> Use this document when building new pages, components, or asking an AI assistant to implement UI.

---

## 1. Creative North Star — "The Obsidian Console"

The admin console is an internal ops tool. It must feel **authoritative, clean, and data-dense** without sacrificing the brand identity. Same Stitch design language as the mobile app — deep violet, emerald accent stripe, ambient shadows — but adapted for a desktop-first information architecture.

**No decorative chrome.** Every pixel earns its place through information value. The sidebar, headers, and cards are minimal; data surfaces are the hero.

**Same no-line rule as mobile.** Section boundaries are defined through background colour shifts, never 1px borders. Table rows are separated by `surfaceHigh` tints, not `border-b`.

---

## 2. Colour System

Delivered as CSS custom properties via the `@theme` directive in `app/globals.css`. All tokens are available as Tailwind utilities and as `var(--token-name)` in inline styles.

### 2.1 Light Mode

| CSS Variable | Hex | Usage |
|---|---|---|
| `--color-background` | `#FAF8FF` | Page background |
| `--color-foreground` | `#1A1B21` | Primary text |
| `--color-card` | `#FFFFFF` | Card / panel background |
| `--color-card-foreground` | `#1A1B21` | Text on cards |
| `--color-popover` | `#FFFFFF` | Dropdown, tooltip background |
| `--color-surface-raised` | `#F4F3FB` | Table thead, elevated section bg |
| `--color-surface-high` | `#E8E7EF` | Row dividers, input bg, inactive tabs |
| `--color-surface-highest` | `#E2E2E9` | Strongest surface lift |
| `--color-surface-tray` | `#EEEDF5` | Nav tray |
| `--color-primary` | `#6E3ACA` | Brand violet — nav active, links, focus |
| `--color-primary-bright` | `#8856E5` | Gradient start for CTAs |
| `--color-primary-soft` | `#EBDDFF` | Active nav item bg, selected filter bg |
| `--color-primary-foreground` | `#FFFFFF` | Text on primary backgrounds |
| `--color-action-fixed` | `#85F8C4` | **Accent stripe** on stat cards (always this value) |
| `--color-action` | `#059669` | Success text |
| `--color-secondary` | `#4A4453` | Secondary text |
| `--color-muted` | `#F4F3FB` | Muted background |
| `--color-muted-foreground` | `#7B7485` | Placeholders, captions, table headers |
| `--color-border` | `#CCC3D6` | Ghost borders (15% opacity only) |
| `--color-input` | `#E8E7EF` | Input field background |
| `--color-ring` | `#6E3ACA` | Focus ring |
| `--color-success` | `#059669` | Confirmed / active labels |
| `--color-success-soft` | `#D1FAE5` | Success badge background |
| `--color-warning` | `#D97706` | Escrow / caution labels |
| `--color-warning-soft` | `#FEF3C7` | Warning badge background |
| `--color-destructive` | `#BA1A1A` | Error / disputed text |
| `--color-destructive-soft` | `#FFDAD6` | Error badge background |
| `--color-accent` | `#EBDDFF` | Accent background |
| `--color-accent-foreground` | `#1A1B21` | Text on accent bg |

### 2.2 Dark Mode Overrides (`.dark` class)

| CSS Variable | Hex |
|---|---|
| `--color-background` | `#0D0B1E` |
| `--color-foreground` | `#E2E2E9` |
| `--color-card` | `#13102B` |
| `--color-surface-raised` | `#1A173D` |
| `--color-surface-high` | `#1C1935` |
| `--color-surface-highest` | `#272445` |
| `--color-surface-tray` | `#13102B` |
| `--color-primary` | `#A78BFA` |
| `--color-primary-bright` | `#C4B5FD` |
| `--color-primary-soft` | `#4A3199` |
| `--color-action-fixed` | `#68DBA9` |
| `--color-action` | `#34D399` |
| `--color-muted-foreground` | `#938F99` |
| `--color-success` | `#68DBA9` |
| `--color-success-soft` | `#064E3B` |
| `--color-warning` | `#FCD34D` |
| `--color-warning-soft` | `#451A03` |
| `--color-destructive` | `#FFB4AB` |
| `--color-destructive-soft` | `#93000A` |

### 2.3 Shadows & Radius

| Variable | Value |
|---|---|
| `--shadow-ambient` | `0 0 40px rgba(26,27,33,0.06)` |
| `--shadow-strong` | `0 20px 50px rgba(26,27,33,0.08)` |
| `--radius-xl` | `1.5rem` |
| `--radius-lg` | `1rem` |
| `--radius-md` | `0.75rem` |
| `--radius-sm` | `0.5rem` |
| `--radius-pill` | `9999px` |

---

## 3. Typography

Fonts loaded in `app/layout.tsx` via `next/font/google`. Used as CSS variable font families.

| Variable | Font | Weights | Usage |
|---|---|---|---|
| `--font-headline` | Manrope | 700, 800 | Page titles, card headings, dialog titles |
| `--font-body` | Work Sans | 400, 500, 600 | All body text, labels, table cells, button text |
| `--font-mono` | JetBrains Mono | 500 | IDs, amounts (₹), voucher codes, numeric data |

### Type Scale

| Element | Size | Font | Weight | Notes |
|---|---|---|---|---|
| Page H1 | `2rem` | headline | 800 | `letterSpacing: -0.04em` |
| Section H2 | `1.75rem` | headline | 700 | `letterSpacing: -0.02em` |
| Card H3 | `1.35rem` | headline | 700 | |
| Body | `0.9375rem` | body | 400 | Base body size |
| Table header | `0.75rem` | body | 600 | `text-transform: uppercase; letter-spacing: 0.06em` |
| Table cell | `0.875rem` | body | 400–500 | |
| Mono value | `0.875rem` | mono | 500 | IDs, amounts |
| Status badge | `0.6875rem` | body | 700 | `text-transform: uppercase; letter-spacing: 0.06em` |

### Typography Rules
- Page headings always use `fontFamily: var(--font-headline)` with `fontWeight: 800` and negative `letterSpacing`
- Table column headers: `text-xs font-semibold uppercase tracking-widest` with `color: var(--color-muted-foreground)`
- All monetary values: `fontFamily: var(--font-mono)` — never body font
- All short IDs: `fontFamily: var(--font-mono)` + `color: var(--color-muted-foreground)`

---

## 4. Layout & Navigation

### Sidebar (`components/Navigation.tsx`)
```
width: 240px (w-60)
position: fixed left-0 top-0
height: 100vh
backgroundColor: var(--color-card)
borderRight: 1px solid var(--color-surface-high)
```

- Logo mark: 36×36px `rounded-xl`, `linear-gradient(135deg, #8856E5, #6E3ACA)`, "CB" in white Manrope 800
- Nav item height: 44px (`h-11`)
- Active item: `backgroundColor: var(--color-primary-soft)`, `color: var(--color-primary)`, left indicator stripe (4×20px, `borderRadius: 2px`, `backgroundColor: var(--color-primary)`)
- Inactive item: `color: var(--color-muted-foreground)`
- Theme selector: `surfaceHigh` bg, no border, `rounded-xl`

### Main content area (`components/PageWrapper.tsx`)
```
marginLeft: 240px  (ml-60) for all non-login pages
padding: 32px  (p-8)
```

### Page Header Pattern
```tsx
<header className="mb-8">
  <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '2rem', fontWeight: 800,
    letterSpacing: '-0.04em', color: 'var(--color-foreground)', marginBottom: '0.25rem' }}>
    Page Title
  </h1>
  <p style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)',
    fontSize: '0.9375rem' }}>
    Subtitle / count
  </p>
</header>
```

No icon box. No icon at all. Just editorial Manrope headline + Work Sans subtitle.

---

## 5. Components

### 5.1 StatCard (`components/StatCard.tsx`)

A metric card with the signature emerald accent stripe on the left.

```
backgroundColor: var(--color-card)
borderRadius: 1rem  (rounded-2xl)
padding: 24px  (p-6)
boxShadow: 0 0 40px rgba(26,27,33,0.06)

// .accent-stripe class — left emerald stripe via ::before pseudo-element
position: relative; overflow: hidden
::before {
  content: ''
  position: absolute; left: 0; top: 16px; bottom: 16px
  width: 5px
  background: var(--color-action-fixed)  /* #85F8C4 light / #68DBA9 dark */
  borderRadius: 0 4px 4px 0
}

// Label: text-xs font-semibold uppercase tracking-widest, muted-foreground, font-body
// Value: text-3xl font-bold tabular-nums, font-mono
//   normal → var(--color-foreground)
//   highlight={true} → var(--color-primary) + pulsing dot indicator (top-right)
// Sub text: text-xs, muted-foreground, font-body
```

When `href` is provided, the card renders as a `<Link>` with `hover:scale-[1.01]`.

### 5.2 Data Tables

All tables follow the same pattern — no shadcn `Table` component, raw `<table>` with inline Stitch styles.

```tsx
// Container
<div className="rounded-2xl overflow-hidden"
  style={{ backgroundColor: 'var(--color-card)', boxShadow: '0 0 40px rgba(26,27,33,0.06)' }}>
  <div className="overflow-x-auto">
    <table className="w-full text-sm">

      // Thead
      <thead>
        <tr style={{ backgroundColor: 'var(--color-surface-raised)' }}>
          <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest whitespace-nowrap"
            style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
            Column
          </th>
        </tr>
      </thead>

      // Tbody
      <tbody>
        <tr style={{ borderTop: '1px solid var(--color-surface-high)' }}>
          <td className="px-5 py-3.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
            Cell value
          </td>
        </tr>
      </tbody>

    </table>
  </div>
</div>
```

- Row padding: `px-5 py-3.5`
- Row dividers: `borderTop: '1px solid var(--color-surface-high)'` (not `divide-y divide-border`)
- IDs: `font-mono`, `color: muted-foreground`, `text-xs`
- Amounts: `font-mono`, `tabular-nums`
- No `border border-border` on the container — ambient shadow only

### 5.3 Status Badges

Use the `.status-badge` CSS class from `globals.css` with inline semantic colour vars:

```tsx
<span className="status-badge"
  style={{ backgroundColor: 'var(--color-warning-soft)', color: 'var(--color-warning)' }}>
  ESCROW ACTIVE
</span>
```

```
.status-badge {
  display: inline-flex; align-items: center; gap: 6px
  padding: 4px 12px
  borderRadius: 9999px
  fontSize: 0.6875rem; fontWeight: 700
  textTransform: uppercase; letterSpacing: 0.06em
  fontFamily: var(--font-body)
}
```

Colour mapping:

| Status | `backgroundColor` | `color` |
|---|---|---|
| ESCROW_ACTIVE / UNDER_REVIEW | `--color-warning-soft` | `--color-warning` |
| CONFIRMED / ACTIVE | `--color-success-soft` | `--color-success` |
| DISPUTED / OPEN | `--color-destructive-soft` | `--color-destructive` |
| CANCELLED / RESOLVED | `--color-surface-high` | `--color-muted-foreground` |
| INITIATED / default | `--color-primary-soft` | `--color-primary` |

### 5.4 Filter Tabs

```tsx
<a
  href="?status=VALUE"
  className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
  style={active
    ? { backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)', fontFamily: 'var(--font-body)' }
    : { backgroundColor: 'var(--color-surface-high)', color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }
  }
>
  Label
</a>
```

No `border` in either state. Active = `primary-soft` bg. Inactive = `surface-high` bg.

### 5.5 Inline Action Buttons (in table rows)

Not `<Button variant="outline">`. Use styled `<button>` elements:

```tsx
// Primary action (e.g. "Mark Paid")
<button className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors"
  style={{ backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)', fontFamily: 'var(--font-body)' }}>
  Mark Paid
</button>

// Destructive action
style={{ backgroundColor: 'var(--color-destructive-soft)', color: 'var(--color-destructive)' }}

// Navigate / view action
style={{ backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}
```

### 5.6 Dialog Info Cells

Inside dialogs (disputes, users, payouts), info display uses `surfaceRaised` cells:

```tsx
<div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-surface-raised)' }}>
  <p className="text-xs font-semibold uppercase tracking-widest mb-0.5"
    style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
    Label
  </p>
  <p className="font-medium" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
    Value
  </p>
</div>
```

### 5.7 Submerged Input (Login)

```
height: 56px (h-14)
borderRadius: 1rem (rounded-2xl)
backgroundColor: var(--color-surface-high)
border: none
padding: horizontal 16px

// Focus (via JS onFocus/onBlur):
boxShadow: 0 0 0 2px var(--color-primary)
backgroundColor: var(--color-card)
```

### 5.8 Primary CTA Button (Login)

```
height: 56px
borderRadius: 1rem
background: linear-gradient(135deg, #8856E5, #6E3ACA)
boxShadow: 0 10px 28px rgba(110,58,202,0.28)
color: white
fontFamily: var(--font-body)
fontWeight: 600
fontSize: 1rem

disabled: opacity-50
```

### 5.9 Warning / Alert Banner

```tsx
<div className="rounded-2xl px-6 py-5"
  style={{ backgroundColor: 'var(--color-warning-soft)', border: '1px solid rgba(217,119,6,0.2)' }}>
  <p className="text-sm font-semibold mb-3"
    style={{ color: 'var(--color-warning)', fontFamily: 'var(--font-headline)' }}>
    Action Required
  </p>
</div>
```

### 5.10 Action Link Cards (Dashboard)

```tsx
<Link href={href}
  className="rounded-2xl p-5 transition-all hover:scale-[1.01]"
  style={{ backgroundColor: 'var(--color-card)', boxShadow: '0 0 40px rgba(26,27,33,0.06)' }}>
  <p className="font-semibold text-sm mb-1"
    style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-foreground)' }}>
    Title
  </p>
  <p className="text-xs"
    style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
    Description
  </p>
</Link>
```

---

## 6. CSS Utilities (from `globals.css`)

### `.accent-stripe`
Adds the 5px left emerald stripe via `::before`. Apply to any card that should have the ticket aesthetic.
```css
.accent-stripe::before {
  content: ''; position: absolute; left: 0; top: 16px; bottom: 16px;
  width: 5px; background: var(--color-action-fixed); border-radius: 0 4px 4px 0;
}
```
Requires `position: relative; overflow: hidden` on the element (included in the class).

### `.card-shadow`
Applies the ambient shadow: `box-shadow: var(--shadow-ambient)`.

### `.status-badge`
Pill badge for status labels — see §5.3.

### `.animate-slide-up`
Entry animation: `opacity 0 → 1`, `translateY(8px) → 0`, 250ms ease-out. Apply to every page's root `<div>`.

---

## 7. Login Page Layout

Two-panel split:

**Left panel (desktop only, `lg:w-1/2`)**
- Background: `linear-gradient(135deg, #2E1F6B 0%, #0D0B1E 100%)`
- Decorative orbs: `#A78BFA` (top-right, 288×288, 20% opacity) + `#85F8C4` (bottom-left, 224×224, 10% opacity)
- Logo mark + "Vouchrex" headline + subtitle
- Feature list: items in `rgba(255,255,255,0.08)` cards with emerald dot indicators

**Right panel (`flex-1`)**
- Background: `var(--color-background)`
- Mobile logo (hidden on desktop)
- Manrope 800 headline + Work Sans subtitle
- Submerged password input + gradient submit button
- Footer note: `text-xs text-center`, `muted-foreground`

---

## 8. Design Rules (Do / Don't)

### Do
- Use `var(--font-headline)` with `fontWeight: 800` and `letterSpacing: -0.04em` for all page H1s
- Use `var(--font-mono)` for every price, ID, and code
- Use `.status-badge` + inline semantic vars for all status indicators
- Use `rounded-2xl` + ambient shadow for all data table containers
- Use `var(--color-surface-raised)` for table `<thead>` backgrounds
- Use `var(--color-surface-high)` for `borderTop` row dividers
- Use `var(--color-action-fixed)` as the accent stripe colour on stat cards

### Don't
- Don't use `border border-border` on cards or table containers — ambient shadow only
- Don't use `bg-muted/50` for table headers — use `var(--color-surface-raised)`
- Don't use `divide-y divide-border` for table rows — use `borderTop: surfaceHigh`
- Don't use `<Badge variant="...">` from shadcn — use `.status-badge` with inline colour vars
- Don't use `<Button variant="outline">` for table row actions — use inline-styled `<button>`
- Don't add icon boxes to page headers — just the Manrope headline
- Don't use Tailwind `text-primary` or `bg-primary` — use `style={{ color: 'var(--color-primary)' }}` for precision
- Don't write `color: 'black'` or `color: '#000'` — always `var(--color-foreground)`
