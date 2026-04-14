# Mobile Coding Standards — VouchrEx

Applies to everything under `apps/mobile/src/`. These rules exist because we spent significant time cleaning up hardcoded values, duplicate components, and dark-mode anti-patterns. They must be followed on every new file and every edit to an existing file.

---

## 1. Theme System — always use it, never bypass it

The theme lives in `src/theme/tokens.ts` and is accessed via `const theme = useTheme()`.

### 1.1 Colors

**Never hardcode a hex color or rgba string.** Every color has a named token.

```tsx
// BAD
backgroundColor: '#6E3ACA'
color: '#FFFFFF'
borderColor: 'rgba(255,255,255,0.18)'
backgroundColor: 'transparent'

// GOOD
backgroundColor: theme.colors.brand
color: theme.colors.white
borderColor: theme.colors.glassBorder
backgroundColor: theme.colors.transparent
```

If you need a color that doesn't exist in the token set, **add it to `tokens.ts` first** with a name that describes its role, then use the token. Do not inline a one-off value.

### 1.2 Spacing

Use `theme.spacing[N]` for all margin, padding, gap, and positional offsets that map to the spacing scale.

| Token | Value |
|---|---|
| `theme.spacing[1]` | 4 |
| `theme.spacing[2]` | 8 |
| `theme.spacing[3]` | 12 |
| `theme.spacing[4]` | 16 |
| `theme.spacing[5]` | 20 |
| `theme.spacing[6]` | 24 |
| `theme.spacing[7]` | 28 |
| `theme.spacing[8]` | 32 |

```tsx
// BAD
paddingHorizontal: 16
gap: 8
marginTop: 24

// GOOD
paddingHorizontal: theme.spacing[4]
gap: theme.spacing[2]
marginTop: theme.spacing[6]
```

Values not on the scale (e.g. `15`, `34`, `38`) are allowed as one-offs — they are component-specific pixel measurements, not layout spacing.

### 1.3 Border Radius

Use `theme.radius.*` for all `borderRadius` values.

| Token | Value |
|---|---|
| `theme.radius.sm` | 12 |
| `theme.radius.md` | 18 |
| `theme.radius.lg` | 24 |
| `theme.radius.xl` | 30 |
| `theme.radius.pill` | 999 |

```tsx
// BAD
borderRadius: 12
borderRadius: 9999
borderRadius: 99

// GOOD
borderRadius: theme.radius.sm
borderRadius: theme.radius.pill
```

### 1.4 Typography

**Font families** — always use `theme.fontFamily.*`:

| Token | Font |
|---|---|
| `theme.fontFamily.headline` | Manrope 700 Bold |
| `theme.fontFamily.headlineExtra` | Manrope 800 ExtraBold |
| `theme.fontFamily.body` | WorkSans 400 Regular |
| `theme.fontFamily.label` | WorkSans 500 Medium |
| `theme.fontFamily.labelSemi` | WorkSans 600 SemiBold |
| `theme.fontFamily.mono` | JetBrainsMono 500 Medium |

**Font sizes** — use `theme.fontSize.*` where it maps:

| Token | Value |
|---|---|
| `theme.fontSize.display` | 32 |
| `theme.fontSize.title` | 22 |
| `theme.fontSize.heading` | 18 |
| `theme.fontSize.body` | 15 |
| `theme.fontSize.label` | 13 |
| `theme.fontSize.caption` | 12 |
| `theme.fontSize.mono` | 16 |

```tsx
// BAD
fontFamily: 'WorkSans_600SemiBold'
fontFamily: 'Manrope_700Bold'
fontSize: 13

// GOOD
fontFamily: theme.fontFamily.labelSemi
fontFamily: theme.fontFamily.headline
fontSize: theme.fontSize.label
```

### 1.5 Gradients

Use `theme.gradients.*` for all `LinearGradient` color arrays.

```tsx
// BAD
colors={['#0D0B1E', '#1A173D', '#2E1F6B']}
colors={['#7C3AED', '#8B5CF6', '#9D77F5', '#A78BFA']}

// GOOD
colors={theme.gradients.signIn}
colors={theme.gradients.brand}
```

If you need a new gradient, define it in `tokens.ts` under `gradients` / `gradientsDark` (separate objects for each theme), then reference via `theme.gradients.*`.

---

## 2. Dark Mode — never branch on colorScheme for colors

The theme tokens already have separate light/dark values. Do not re-implement dark mode logic inside components.

```tsx
// BAD — the theme already handles this
const scheme = useColorScheme();
backgroundColor: scheme === 'dark' ? '#13102B' : '#FFFFFF'
color: scheme === 'dark' ? '#E2E2E9' : '#1A1B21'

// GOOD
backgroundColor: theme.colors.surface
color: theme.colors.ink
```

**Only allowed exception:** `tint` prop on `BlurView` from `expo-blur`, which requires a string `'light'|'dark'|'default'` — not a color value. Use `useColorScheme()` only for that prop.

---

## 3. Component Rules

### 3.1 No inline component definitions

Never define a component function inside another component or module body if it will be reused by more than one screen. Extract it.

```tsx
// BAD — defined inside sell.tsx but needed in other screens
function SubmergedInput(...) { ... }

// GOOD
// src/components/submerged-input.tsx
export function SubmergedInput(...) { ... }
```

### 3.2 Extract when the same JSX block appears twice

If you write identical (or near-identical) JSX in two places, extract a component. Three similar lines of code is fine; two identical 20-line JSX blocks is a component waiting to be born.

### 3.3 Props must be `readonly`

All component prop interfaces use `readonly` on each field:

```tsx
// BAD
function Card({ title, onPress }: { title: string; onPress: () => void }) {}

// GOOD
function Card({ title, onPress }: { readonly title: string; readonly onPress: () => void }) {}
```

### 3.4 No anonymous default exports for screens

Screen files use named `export default function XxxScreen()` so stack traces are readable.

---

## 4. TypeScript Strictness

### 4.1 No `!` non-null assertions

```tsx
// BAD
const url = process.env.API_URL!

// GOOD
const url = process.env['API_URL'] ?? ''
```

### 4.2 No `as any` or unsafe casts

If a third-party type is wrong, augment it with a `.d.ts` file rather than casting.

### 4.3 Floating promises must be handled

```tsx
// BAD
auth.signOut()

// GOOD
void auth.signOut()
// or
void auth.signOut().then(() => router.replace('/sign-in'))
```

### 4.4 Template literals with non-string values

Always stringify explicitly:

```tsx
// BAD
`Retry in ${seconds}s`   // seconds is a number — TS strict complains

// GOOD
`Retry in ${String(seconds)}s`
```

---

## 5. Module-level Constants

Constants that contain design values (colors, sizes, gradients) **must not** live at module level as raw literals. They belong in the theme.

```tsx
// BAD — module level, bypasses theme, breaks light mode
const GRADIENT = ['#0D0B1E', '#1A173D', '#2E1F6B'] as const;
const BRAND_COLOR = '#6E3ACA';

// GOOD — derived from theme inside the component
const theme = useTheme();
// use theme.gradients.signIn, theme.colors.brand, etc.
```

Module-level constants are fine for non-design values (regex patterns, string literals, config flags).

---

## 6. Shared Logic — `src/lib/`

Status label/color mapping, error normalization, and other pure functions that are used across more than one screen belong in `src/lib/`, not inlined.

```
src/lib/
  api.ts        HTTP client
  storage.ts    SecureStore wrapper
  status.ts     Order/listing status helpers (labels, colors, icons)
```

Before adding a new status helper inline in a screen, check `src/lib/status.ts` first.

---

## 7. Image Imports

PNG assets use the module declaration in `src/types/images.d.ts`. Do not add image type declarations anywhere else.

```tsx
// BAD — type declaration in wrong file or missing
import heroIcon from '../../assets/images/hero-icon.png'; // type error without declaration

// GOOD — src/types/images.d.ts declares: declare module '*.png' { const value: number; export default value; }
import heroIcon from '../../assets/images/hero-icon.png'; // clean
```

---

## 8. Adding New Theme Tokens

When a value is needed that doesn't exist yet:

1. Identify the correct category (`colors`, `gradients`, `spacing`, `radius`, `fontSize`, `fontFamily`).
2. Add the token to **both** `lightTheme` and `darkTheme` in `tokens.ts` (or the shared constant if it's theme-independent).
3. Give it a role-based name, not a visual name: `actionSoft` not `lightGreen`, `surfaceHigh` not `grayLight`.
4. Use the token everywhere — never the raw value.

---

## 9. Quick Checklist Before Committing

- [ ] No hex literals in style objects
- [ ] No `rgba(...)` strings in style objects  
- [ ] No `'transparent'` string literal (use `theme.colors.transparent`)
- [ ] No `'#FFFFFF'` or `'white'` (use `theme.colors.white`)
- [ ] No hardcoded font family strings
- [ ] No `colorScheme === 'dark' ? ... : ...` for colors
- [ ] No module-level color/gradient constants
- [ ] No duplicate JSX blocks that should be a component
- [ ] No floating promises (use `void` or `await`)
- [ ] All prop interfaces use `readonly`
