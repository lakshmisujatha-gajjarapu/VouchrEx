# Design: Centralize API Route Constants

**Date:** 2026-04-11  
**Status:** Draft — awaiting user review  
**Scope:** `apps/mobile` and `apps/api`

---

## Problem

API route strings are currently scattered as hardcoded literals throughout the codebase:

- **Mobile** (`apps/mobile/src/lib/api.ts`): ~30 endpoint paths inlined inside method bodies
- **NestJS API** (`apps/api/src/modules/*/`): route segments in decorator arguments across 9+ controllers
- **Admin** (`apps/admin/lib/api.ts`): ~10 endpoint paths inlined (out of scope for now)

This means renaming or restructuring a route requires a multi-file search. There is no single source of truth.

---

## Goals

- One place per app to find/change any route string
- No runtime behavior changes — purely a refactor
- Follow the folder structure the user specified: `routes/index.ts` re-exporting per-domain files

---

## Approaches Considered

### Option A: Mobile only
Create `apps/mobile/src/lib/routes/` with per-domain constants. Leave API decorators untouched.

**Pro:** Smallest diff, lowest risk.  
**Con:** API still has scattered literals.

### Option B: Mobile + API (recommended)
Create route constant files for both the mobile API client and the NestJS controllers.

**Pro:** True DRY — renaming a segment updates in one place on each side.  
**Con:** Slightly more files.

### Option C: Shared package
Create `packages/routes` that both mobile and API import from.

**Pro:** Single source of truth across the wire boundary.  
**Con:** Requires new Yarn workspace, Prisma/TS config changes, overkill for Phase 1.

**Recommendation: Option B.** Shared package is premature; mobile-only leaves half the problem unsolved.

---

## Design

### Mobile — `apps/mobile/src/lib/routes/`

```
apps/mobile/src/lib/routes/
  index.ts           ← re-exports all domains
  auth.ts
  listings.ts
  orders.ts
  brands.ts
  notifications.ts
  payouts.ts
```

Each file exports a plain `const` object with route segment strings. Dynamic segments use functions.

**Example — `auth.ts`:**
```ts
export const AUTH = {
  OTP_REQUEST:    '/auth/otp/request',
  OTP_VERIFY:     '/auth/otp/verify',
  TOKEN_REFRESH:  '/auth/token/refresh',
  ME:             '/auth/me',
  LOGOUT:         '/auth/logout',
} as const;
```

**Example — `orders.ts`** (dynamic segments as functions):
```ts
export const ORDERS = {
  LIST:                '/orders',
  CREATE:              '/orders',
  GET:                 (id: string) => `/orders/${id}`,
  CHECKOUT:            (id: string) => `/orders/${id}/checkout`,
  PAYMENTS_VERIFY:     (id: string) => `/orders/${id}/payments/verify`,
  PAYMENTS_SYNC:       (id: string) => `/orders/${id}/payments/sync`,
  REVEAL:              (id: string) => `/orders/${id}/reveal`,
  CONFIRM:             (id: string) => `/orders/${id}/confirm`,
  DISPUTES:            (id: string) => `/orders/${id}/disputes`,
  DISPUTE_SELLER_RESP: (id: string) => `/orders/disputes/${id}/seller-response`,
  DISPUTE_RESOLVE:     (id: string) => `/orders/disputes/${id}/resolve`,
} as const;
```

**`index.ts`:**
```ts
export { AUTH }          from './auth';
export { LISTINGS }      from './listings';
export { ORDERS }        from './orders';
export { BRANDS }        from './brands';
export { NOTIFICATIONS } from './notifications';
export { PAYOUTS }       from './payouts';
```

**Usage in `api.ts`** — before vs after:
```ts
// Before
const res = await fetch(`${base}/orders/${orderId}/confirm`, ...);

// After
import { ORDERS } from './routes';
const res = await fetch(`${base}${ORDERS.CONFIRM(orderId)}`, ...);
```

---

### NestJS API — per-module `*.routes.ts` files

Each module gets a `<domain>.routes.ts` alongside its controller. Route segments (not full paths) are extracted there, matching the controller's `@Controller()` prefix.

```
apps/api/src/modules/
  auth/
    auth.routes.ts       ← new
    auth.controller.ts   ← updated to use constants
  listings/
    listings.routes.ts
    listings.controller.ts
  orders/
    orders.routes.ts
    orders.controller.ts
  ... (brands, notifications, payouts, admin, webhooks, users, health)
```

**Example — `auth.routes.ts`:**
```ts
export const AUTH_ROUTES = {
  BASE:          'auth',
  OTP_REQUEST:   'otp/request',
  OTP_VERIFY:    'otp/verify',
  TOKEN_REFRESH: 'token/refresh',
  ME:            'me',
  LOGOUT:        'logout',
} as const;
```

**Usage in controller:**
```ts
// Before
@Controller('auth')
export class AuthController {
  @Post('otp/request')
  ...

// After
import { AUTH_ROUTES } from './auth.routes';

@Controller(AUTH_ROUTES.BASE)
export class AuthController {
  @Post(AUTH_ROUTES.OTP_REQUEST)
  ...
```

Note: The NestJS API does **not** get a top-level `routes/index.ts` barrel — each module owns its own routes file and there is no cross-module import of route strings. This keeps modules self-contained.

---

## Files Changed

### Mobile
| Action | File |
|--------|------|
| Create | `apps/mobile/src/lib/routes/auth.ts` |
| Create | `apps/mobile/src/lib/routes/listings.ts` |
| Create | `apps/mobile/src/lib/routes/orders.ts` |
| Create | `apps/mobile/src/lib/routes/brands.ts` |
| Create | `apps/mobile/src/lib/routes/notifications.ts` |
| Create | `apps/mobile/src/lib/routes/payouts.ts` |
| Create | `apps/mobile/src/lib/routes/index.ts` |
| Update | `apps/mobile/src/lib/api.ts` |

### API
| Action | File |
|--------|------|
| Create | `apps/api/src/modules/auth/auth.routes.ts` |
| Create | `apps/api/src/modules/listings/listings.routes.ts` |
| Create | `apps/api/src/modules/orders/orders.routes.ts` |
| Create | `apps/api/src/modules/brands/brands.routes.ts` |
| Create | `apps/api/src/modules/notifications/notifications.routes.ts` |
| Create | `apps/api/src/modules/payouts/payouts.routes.ts` |
| Create | `apps/api/src/modules/admin/admin.routes.ts` |
| Create | `apps/api/src/modules/users/users.routes.ts` |
| Create | `apps/api/src/modules/health/health.routes.ts` |
| Create | `apps/api/src/modules/webhooks/webhooks.routes.ts` |
| Update | All 9 controllers listed above |

---

## Non-Goals

- No runtime behavior changes
- No changes to the Admin app (`apps/admin`) in this pass
- No shared cross-app package
- No changes to Swagger docs, Prisma, or test files

---

## Success Criteria

- `make typecheck` passes on both workspaces after the change
- No literal route strings remain in `apps/mobile/src/lib/api.ts`
- No literal route strings remain in API controller `@Get`/`@Post`/`@Patch`/`@Delete` decorators (dynamic param tokens like `':id'` will still appear but as `ROUTES.BY_ID` constants)
