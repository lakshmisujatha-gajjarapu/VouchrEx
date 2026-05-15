# UX Improvement Plan — Vouchrex Mobile

This document outlines the strategy for transforming the current static "blunt" UI into a fluid, interactive "Digital Vault" experience using `react-native-reanimated` and `react-native-gesture-handler`.

## Cross-cutting Rule: Reduced Motion

Every animated component must call `useReducedMotion()` from `react-native-reanimated` and fall back to an instant/static alternative:

| Component | Reduced-motion fallback |
|---|---|
| `InteractivePressable` | Skip spring; use opacity `0.85` only |
| Layout animations (`FadeInDown`, `LinearTransition`) | Disable entering/exiting presets; items appear instantly |
| Skeleton shimmer gradient | Stop gradient movement; keep static muted ghost card |
| Tab bar sliding pill | `withTiming(x, { duration: 0 })` — snap immediately |
| Screen `FadeIn` entrance | Skip; render at full opacity |

---

## 1. Advanced Press Interactions (`TouchableScale`)
**Current:** Simple `opacity` and `scale: 0.98` using `Pressable`'s `pressed` state.
**Improvement:** Use `Reanimated` with `useAnimatedStyle` and `withSpring` for a more tactile, bouncy feel.
- **Component:** `InteractivePressable`
- **Effect:** Substantial but subtle scale down on press (`0.96`), spring back on release.
- **Usage:** Wrap `PrimaryButton`, `TicketCard`, and `ListingCard`.

## 2. Layout Animations (Fluid Filtering)
**Current:** List items pop in/out instantly when filtering or searching in the Shop.
**Improvement:** Use `reanimated` Layout Animations to make the grid feel "alive".
- **Logic:** `LinearTransition`, `FadeInDown.springify()`, `FadeOut.duration(200)`.
- **Target:** `ShopScreen` listings and `HorizontalChipRow`.

## 3. Skeleton Loaders (Perceived Performance)
**Current:** Standard `ActivityIndicator` (spinner) during data fetching.
**Improvement:** Shimmering "Ghost" cards that match the geometry of the `ListingCard`.
- **Component:** `ListingCardSkeleton`
- **Effect:** Linear gradient shimmer moving from left to right.
- **Benefit:** Reduces perceived wait time and prevents layout shifts.

## 4. Animated Floating Tab Bar
**Current:** Static icons with a `brandSoft` background that pops into place.
**Improvement:** A sliding background "pill" that follows the active tab.
- **Logic:** Shared `translateX` value based on tab index.
- **Effect:** Smooth transition as the user navigates between segments.

## 5. Micro-interactions & Haptics (Optional/Future)
- **Pull-to-refresh:** A custom animated loader instead of the system default.
- **Success/Error States:** Animated icons (Checkmarks/Crosses) using `Reanimated`.
- **Haptics:** (Requires `expo-haptics`) Subtle ticks on slider adjustments and button presses.

## 6. Glassmorphism Expansion

**Current state:** Already partially implemented. `FloatingTabBar` uses `BlurView` (intensity 60) + `glassSurface`/`glassBorder` tokens. Both themes already carry these tokens.

**Principle (from UX skill `blur-purpose`):** Blur should signal *background dismissal or depth layering* — not be applied as surface decoration. The dark theme (`#0D0B1E` deep violet background) is ideal; the light theme's `#FAF8FF` is too pale to show contrast through glass without a gradient beneath it.

### Where to expand glass

| Surface | Apply? | Notes |
|---|---|---|
| `FloatingTabBar` | ✅ Already done | Increase intensity to 80 in dark mode for stronger depth |
| Screen headers (sticky) | ✅ Add | Blur content scrolling beneath a fixed title bar — creates hierarchy, works in both themes |
| Bottom sheet / modal backdrops | ✅ Add | BlurView as scrim replacement signals the sheet is dismissable (see `modal-motion` rule) |
| `ListingCard` | ⚠️ Dark only | Solid `surface` on light; switch to glass tint only when rendered over a gradient hero on the shop screen |
| `TicketCard` | ❌ Skip | Semantic tone backgrounds (danger/warning/success) need solid color to convey meaning — glass obscures them |
| `PrimaryButton` | ❌ Skip | CTA trust requires solid brand color; glass feels uncertain/weak |
| Form inputs (`TextField`, `SubmergedInput`) | ❌ Skip | Readability requires solid contrast — glass fails WCAG 4.5:1 |

### New tokens needed in `tokens.ts`

```ts
// Glass — expanded set (add to both lightTheme and darkTheme)
glassIntensityLow:    60,   // current tab bar value
glassIntensityMid:    80,   // headers, cards over gradients
glassIntensityHigh:   95,   // modal backdrops

glassSurfaceStrong:   'rgba(255,255,255,0.14)',  // light theme header
glassSurfaceDark:     'rgba(13,11,30,0.55)',     // dark theme modal scrim
glassBorderLight:     'rgba(255,255,255,0.22)',  // light surfaces
glassBorderDark:      'rgba(167,139,250,0.15)',  // dark — brand-tinted edge
```

### Reduced-motion rule

All `BlurView` components are static (no animation), so they are safe for users with Reduce Motion enabled. The animated sliding pill on the tab bar (Phase 3) must snap instantly when `useReducedMotion()` returns `true`.

### Implementation targets (by phase)

- **Phase 3 (Fluidity):** Glassy sticky header on `ShopScreen` — `BlurView` wrapping the search bar so list items visually pass beneath it.
- **Phase 4 (Refinement):** Glassy bottom sheet for filter/sort drawer. Replace solid modal backdrops with `BlurView` scrim at `glassIntensityHigh`.

---

## Implementation Roadmap

### Phase 1: Foundation
1. Create `src/components/interactive-pressable.tsx`.
2. Update `PrimaryButton` and `TicketCard` to use it.

### Phase 2: Perceived Speed
1. Implement `src/components/skeletons/listing-skeleton.tsx`.
2. Update `ShopScreen` to show skeletons instead of the spinner.

### Phase 3: Fluidity
1. Add Layout Animations to `ShopScreen` listing items.
2. Refactor `FloatingTabBar` for smooth indicator transitions.

### Phase 4: Refinement
1. Add subtle entrance animations to screens (`FadeIn`).
2. Polish the `DiscountSlider` with spring-based thumb movement.
