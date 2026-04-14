# API Routes Centralization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract all hardcoded route strings from `apps/mobile/src/lib/api.ts` and all NestJS controllers into per-domain constant files — a pure refactor with no runtime behavior changes.

**Architecture:** Mobile gets `apps/mobile/src/lib/routes/` with one file per domain re-exported from `index.ts`. The API gets one `<domain>.routes.ts` file alongside each controller; no cross-module imports. `api.ts` and each controller are updated to reference the constants.

**Tech Stack:** TypeScript `as const` objects and arrow functions for dynamic segments. No new packages.

---

## File Map

### Create (Mobile)
| File | Purpose |
|------|---------|
| `apps/mobile/src/lib/routes/auth.ts` | Auth endpoint constants |
| `apps/mobile/src/lib/routes/brands.ts` | Brands endpoint constants |
| `apps/mobile/src/lib/routes/listings.ts` | Listings endpoint constants |
| `apps/mobile/src/lib/routes/orders.ts` | Orders endpoint constants |
| `apps/mobile/src/lib/routes/payouts.ts` | Payout-accounts endpoint constants |
| `apps/mobile/src/lib/routes/notifications.ts` | Notifications endpoint constants |
| `apps/mobile/src/lib/routes/index.ts` | Re-exports all domains |

### Modify (Mobile)
| File | Change |
|------|--------|
| `apps/mobile/src/lib/api.ts` | Replace all literal strings with route constants |

### Create (API — one file per module)
| File | Purpose |
|------|---------|
| `apps/api/src/modules/auth/auth.routes.ts` | Auth route segments |
| `apps/api/src/modules/listings/listings.routes.ts` | Listings route segments |
| `apps/api/src/modules/orders/orders.routes.ts` | Orders route segments |
| `apps/api/src/modules/brands/brands.routes.ts` | Brands route segments |
| `apps/api/src/modules/notifications/notifications.routes.ts` | Notifications route segments |
| `apps/api/src/modules/payouts/payout-accounts.routes.ts` | Payout-accounts route segments |
| `apps/api/src/modules/admin/admin.routes.ts` | Admin route segments |
| `apps/api/src/modules/users/users.routes.ts` | Users route segments |
| `apps/api/src/modules/health/health.routes.ts` | Health route segments |
| `apps/api/src/modules/webhooks/webhooks.routes.ts` | Webhooks route segments |

### Modify (API controllers)
All 10 controllers listed above are updated to use their routes files.

---

## Task 1 — Mobile: Create route constant files

**Files:**
- Create: `apps/mobile/src/lib/routes/auth.ts`
- Create: `apps/mobile/src/lib/routes/brands.ts`
- Create: `apps/mobile/src/lib/routes/listings.ts`
- Create: `apps/mobile/src/lib/routes/orders.ts`
- Create: `apps/mobile/src/lib/routes/payouts.ts`
- Create: `apps/mobile/src/lib/routes/notifications.ts`
- Create: `apps/mobile/src/lib/routes/index.ts`

- [ ] **Step 1: Create `routes/auth.ts`**

```ts
export const AUTH = {
  OTP_REQUEST:   '/auth/otp/request',
  OTP_VERIFY:    '/auth/otp/verify',
  TOKEN_REFRESH: '/auth/token/refresh',
  ME:            '/auth/me',
  LOGOUT:        '/auth/logout',
} as const;
```

- [ ] **Step 2: Create `routes/brands.ts`**

```ts
export const BRANDS = {
  LIST: '/brands',
} as const;
```

- [ ] **Step 3: Create `routes/listings.ts`**

```ts
export const LISTINGS = {
  LIST:             '/listings',
  CREATE:           '/listings',
  BY_ID:            (id: string) => `/listings/${id}`,
  SELLER_INVENTORY: '/listings/seller/inventory',
} as const;
```

- [ ] **Step 4: Create `routes/orders.ts`**

```ts
export const ORDERS = {
  LIST:                '/orders',
  CREATE:              '/orders',
  BY_ID:               (id: string) => `/orders/${id}`,
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

- [ ] **Step 5: Create `routes/payouts.ts`**

```ts
export const PAYOUTS = {
  REGISTER: '/payout-accounts',
  ME:       '/payout-accounts/me',
} as const;
```

- [ ] **Step 6: Create `routes/notifications.ts`**

```ts
export const NOTIFICATIONS = {
  LIST:       '/notifications',
  CLEAR_ALL:  '/notifications',
  READ_ALL:   '/notifications/read-all',
  BY_ID_READ: (id: string) => `/notifications/${id}/read`,
} as const;
```

- [ ] **Step 7: Create `routes/index.ts`**

```ts
export { AUTH }          from './auth';
export { BRANDS }        from './brands';
export { LISTINGS }      from './listings';
export { NOTIFICATIONS } from './notifications';
export { ORDERS }        from './orders';
export { PAYOUTS }       from './payouts';
```

---

## Task 2 — Mobile: Update `api.ts` to use route constants

**Files:**
- Modify: `apps/mobile/src/lib/api.ts`

- [ ] **Step 1: Add route imports at the top of `api.ts`**

After the existing `import { Platform } from 'react-native';` line, add:

```ts
import { AUTH, BRANDS, LISTINGS, NOTIFICATIONS, ORDERS, PAYOUTS } from './routes';
```

- [ ] **Step 2: Replace auth call sites**

| Before | After |
|--------|-------|
| `'/auth/otp/request'` | `AUTH.OTP_REQUEST` |
| `'/auth/otp/verify'` | `AUTH.OTP_VERIFY` |
| `'/auth/token/refresh'` | `AUTH.TOKEN_REFRESH` |
| `'/auth/me'` | `AUTH.ME` |
| `'/auth/logout'` | `AUTH.LOGOUT` |

- [ ] **Step 3: Replace brands call site**

| Before | After |
|--------|-------|
| `'/brands'` | `BRANDS.LIST` |

- [ ] **Step 4: Replace listings call sites**

| Before | After |
|--------|-------|
| `'/listings'` in `listListings` | `LISTINGS.LIST` |
| `'/listings'` in `createListing` | `LISTINGS.CREATE` |
| `` `/listings/${id}` `` in `getListing` | `LISTINGS.BY_ID(id)` |
| `'/listings/seller/inventory'` | `LISTINGS.SELLER_INVENTORY` |
| `` `/listings/${id}` `` in `updateListing` | `LISTINGS.BY_ID(id)` |
| `` `/listings/${id}` `` in `deleteListing` | `LISTINGS.BY_ID(id)` |

- [ ] **Step 5: Replace orders call sites**

| Before | After |
|--------|-------|
| `'/orders'` in `listOrders` | `ORDERS.LIST` |
| `'/orders'` in `createOrder` | `ORDERS.CREATE` |
| `` `/orders/${id}` `` in `getOrder` | `ORDERS.BY_ID(id)` |
| `` `/orders/${orderId}/checkout` `` | `ORDERS.CHECKOUT(orderId)` |
| `` `/orders/${orderId}/payments/verify` `` | `ORDERS.PAYMENTS_VERIFY(orderId)` |
| `` `/orders/${orderId}/payments/sync` `` | `ORDERS.PAYMENTS_SYNC(orderId)` |
| `` `/orders/${orderId}/reveal` `` | `ORDERS.REVEAL(orderId)` |
| `` `/orders/${orderId}/confirm` `` | `ORDERS.CONFIRM(orderId)` |
| `` `/orders/${orderId}/disputes` `` | `ORDERS.DISPUTES(orderId)` |

- [ ] **Step 6: Replace payouts call sites**

| Before | After |
|--------|-------|
| `'/payout-accounts/me'` | `PAYOUTS.ME` |
| `'/payout-accounts'` | `PAYOUTS.REGISTER` |

- [ ] **Step 7: Replace notifications call sites**

| Before | After |
|--------|-------|
| `'/notifications'` in `listNotifications` | `NOTIFICATIONS.LIST` |
| `'/notifications/read-all'` | `NOTIFICATIONS.READ_ALL` |
| `'/notifications'` in `clearAllNotifications` | `NOTIFICATIONS.CLEAR_ALL` |
| `` `/notifications/${notificationId}/read` `` | `NOTIFICATIONS.BY_ID_READ(notificationId)` |

- [ ] **Step 8: Typecheck mobile workspace**

```bash
yarn workspace vouchrex-mobile typecheck
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/lib/routes/ apps/mobile/src/lib/api.ts
git commit -m "refactor(mobile): centralize API route strings into route constants"
```

---

## Task 3 — API: Auth and Listings

**Files:**
- Create: `apps/api/src/modules/auth/auth.routes.ts`
- Modify: `apps/api/src/modules/auth/auth.controller.ts`
- Create: `apps/api/src/modules/listings/listings.routes.ts`
- Modify: `apps/api/src/modules/listings/listings.controller.ts`

- [ ] **Step 1: Create `auth/auth.routes.ts`**

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

- [ ] **Step 2: Update `auth/auth.controller.ts`**

Add import after existing imports:
```ts
import { AUTH_ROUTES } from './auth.routes';
```

Replace decorator strings:
| Before | After |
|--------|-------|
| `@Controller('auth')` | `@Controller(AUTH_ROUTES.BASE)` |
| `@Post('otp/request')` | `@Post(AUTH_ROUTES.OTP_REQUEST)` |
| `@Post('otp/verify')` | `@Post(AUTH_ROUTES.OTP_VERIFY)` |
| `@Post('token/refresh')` | `@Post(AUTH_ROUTES.TOKEN_REFRESH)` |
| `@Get('me')` | `@Get(AUTH_ROUTES.ME)` |
| `@Post('logout')` | `@Post(AUTH_ROUTES.LOGOUT)` |

- [ ] **Step 3: Create `listings/listings.routes.ts`**

```ts
export const LISTINGS_ROUTES = {
  BASE:             'listings',
  BY_ID:            ':id',
  SELLER_INVENTORY: 'seller/inventory',
} as const;
```

- [ ] **Step 4: Update `listings/listings.controller.ts`**

Add import after existing imports:
```ts
import { LISTINGS_ROUTES } from './listings.routes';
```

Replace decorator strings:
| Before | After |
|--------|-------|
| `@Controller('listings')` | `@Controller(LISTINGS_ROUTES.BASE)` |
| `@Get('seller/inventory')` | `@Get(LISTINGS_ROUTES.SELLER_INVENTORY)` |
| `@Get(':id')` | `@Get(LISTINGS_ROUTES.BY_ID)` |
| `@Patch(':id')` | `@Patch(LISTINGS_ROUTES.BY_ID)` |
| `@Delete(':id')` | `@Delete(LISTINGS_ROUTES.BY_ID)` |

- [ ] **Step 5: Typecheck API workspace**

```bash
yarn workspace vouchrex-api typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/auth/ apps/api/src/modules/listings/
git commit -m "refactor(api): extract auth and listings route strings into constants"
```

---

## Task 4 — API: Orders

**Files:**
- Create: `apps/api/src/modules/orders/orders.routes.ts`
- Modify: `apps/api/src/modules/orders/orders.controller.ts`

- [ ] **Step 1: Create `orders/orders.routes.ts`**

```ts
export const ORDERS_ROUTES = {
  BASE:                'orders',
  BY_ID:               ':id',
  CHECKOUT:            ':id/checkout',
  PAYMENTS_VERIFY:     ':id/payments/verify',
  PAYMENTS_SYNC:       ':id/payments/sync',
  REVEAL:              ':id/reveal',
  CONFIRM:             ':id/confirm',
  DISPUTES:            ':id/disputes',
  DISPUTE_SELLER_RESP: 'disputes/:id/seller-response',
  DISPUTE_RESOLVE:     'disputes/:id/resolve',
} as const;
```

- [ ] **Step 2: Update `orders/orders.controller.ts`**

Add import after existing imports:
```ts
import { ORDERS_ROUTES } from './orders.routes';
```

Replace decorator strings:
| Before | After |
|--------|-------|
| `@Controller('orders')` | `@Controller(ORDERS_ROUTES.BASE)` |
| `@Get(':id')` | `@Get(ORDERS_ROUTES.BY_ID)` |
| `@Post(':id/checkout')` | `@Post(ORDERS_ROUTES.CHECKOUT)` |
| `@Post(':id/payments/verify')` | `@Post(ORDERS_ROUTES.PAYMENTS_VERIFY)` |
| `@Post(':id/payments/sync')` | `@Post(ORDERS_ROUTES.PAYMENTS_SYNC)` |
| `@Post(':id/reveal')` | `@Post(ORDERS_ROUTES.REVEAL)` |
| `@Post(':id/confirm')` | `@Post(ORDERS_ROUTES.CONFIRM)` |
| `@Post(':id/disputes')` | `@Post(ORDERS_ROUTES.DISPUTES)` |
| `@Post('disputes/:id/seller-response')` | `@Post(ORDERS_ROUTES.DISPUTE_SELLER_RESP)` |
| `@Post('disputes/:id/resolve')` | `@Post(ORDERS_ROUTES.DISPUTE_RESOLVE)` |

Note: The bare `@Get()` and `@Post()` on the list/create methods have no string argument — leave them as-is.

- [ ] **Step 3: Typecheck API workspace**

```bash
yarn workspace vouchrex-api typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/orders/
git commit -m "refactor(api): extract orders route strings into constants"
```

---

## Task 5 — API: Brands, Notifications, Payouts

**Files:**
- Create: `apps/api/src/modules/brands/brands.routes.ts`
- Modify: `apps/api/src/modules/brands/brands.controller.ts`
- Create: `apps/api/src/modules/notifications/notifications.routes.ts`
- Modify: `apps/api/src/modules/notifications/notifications.controller.ts`
- Create: `apps/api/src/modules/payouts/payout-accounts.routes.ts`
- Modify: `apps/api/src/modules/payouts/payout-accounts.controller.ts`

- [ ] **Step 1: Create `brands/brands.routes.ts`**

```ts
export const BRANDS_ROUTES = {
  BASE: 'brands',
  SEED: 'seed',
} as const;
```

- [ ] **Step 2: Update `brands/brands.controller.ts`**

Add import after existing imports:
```ts
import { BRANDS_ROUTES } from './brands.routes';
```

Replace decorator strings:
| Before | After |
|--------|-------|
| `@Controller('brands')` | `@Controller(BRANDS_ROUTES.BASE)` |
| `@Post('seed')` | `@Post(BRANDS_ROUTES.SEED)` |

- [ ] **Step 3: Create `notifications/notifications.routes.ts`**

```ts
export const NOTIFICATIONS_ROUTES = {
  BASE:       'notifications',
  READ_ALL:   'read-all',
  BY_ID_READ: ':id/read',
} as const;
```

- [ ] **Step 4: Update `notifications/notifications.controller.ts`**

Add import after existing imports:
```ts
import { NOTIFICATIONS_ROUTES } from './notifications.routes';
```

Replace decorator strings:
| Before | After |
|--------|-------|
| `@Controller('notifications')` | `@Controller(NOTIFICATIONS_ROUTES.BASE)` |
| `@Post('read-all')` | `@Post(NOTIFICATIONS_ROUTES.READ_ALL)` |
| `@Post(':id/read')` | `@Post(NOTIFICATIONS_ROUTES.BY_ID_READ)` |

Note: The bare `@Get()` and `@Delete()` have no string argument — leave them as-is.

- [ ] **Step 5: Create `payouts/payout-accounts.routes.ts`**

```ts
export const PAYOUT_ACCOUNTS_ROUTES = {
  BASE: 'payout-accounts',
  ME:   'me',
} as const;
```

- [ ] **Step 6: Update `payouts/payout-accounts.controller.ts`**

Add import after existing imports:
```ts
import { PAYOUT_ACCOUNTS_ROUTES } from './payout-accounts.routes';
```

Replace decorator strings:
| Before | After |
|--------|-------|
| `@Controller('payout-accounts')` | `@Controller(PAYOUT_ACCOUNTS_ROUTES.BASE)` |
| `@Get('me')` | `@Get(PAYOUT_ACCOUNTS_ROUTES.ME)` |

Note: The bare `@Post()` has no string argument — leave it as-is.

- [ ] **Step 7: Typecheck API workspace**

```bash
yarn workspace vouchrex-api typecheck
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/brands/ apps/api/src/modules/notifications/ apps/api/src/modules/payouts/
git commit -m "refactor(api): extract brands, notifications, and payouts route strings into constants"
```

---

## Task 6 — API: Admin

**Files:**
- Create: `apps/api/src/modules/admin/admin.routes.ts`
- Modify: `apps/api/src/modules/admin/admin.controller.ts`

- [ ] **Step 1: Create `admin/admin.routes.ts`**

```ts
export const ADMIN_ROUTES = {
  BASE:                     'admin',
  METRICS:                  'metrics',
  DISPUTES:                 'disputes',
  ORDERS:                   'orders',
  USERS:                    'users',
  USER_APPROVE_KYC:         'users/:id/approve-kyc',
  USER_REJECT_KYC:          'users/:id/reject-kyc',
  USER_SUSPEND:             'users/:id/suspend',
  USER_REACTIVATE:          'users/:id/reactivate',
  PAYOUTS_PENDING:          'payouts/pending',
  ORDER_RETRY_PAYOUT:       'orders/:orderId/retry-payout',
  ORDER_COMPLETE_PAYOUT:    'orders/:orderId/complete-payout',
  AUTH_LOGIN:               'auth/login',
  AUTH_LOGOUT:              'auth/logout',
  ME:                       'me',
  TEAM:                     'team',
  TEAM_MEMBER_DEACTIVATE:   'team/:id/deactivate',
  TEAM_MEMBER_ACTIVATE:     'team/:id/activate',
  TEAM_MEMBER_SET_PASSWORD: 'team/:id/set-password',
} as const;
```

- [ ] **Step 2: Update `admin/admin.controller.ts`**

Add import after existing imports:
```ts
import { ADMIN_ROUTES } from './admin.routes';
```

Replace decorator strings (19 replacements):
| Before | After |
|--------|-------|
| `@Controller('admin')` | `@Controller(ADMIN_ROUTES.BASE)` |
| `@Get('metrics')` | `@Get(ADMIN_ROUTES.METRICS)` |
| `@Get('disputes')` | `@Get(ADMIN_ROUTES.DISPUTES)` |
| `@Get('orders')` | `@Get(ADMIN_ROUTES.ORDERS)` |
| `@Get('users')` | `@Get(ADMIN_ROUTES.USERS)` |
| `@Post('users/:id/approve-kyc')` | `@Post(ADMIN_ROUTES.USER_APPROVE_KYC)` |
| `@Post('users/:id/reject-kyc')` | `@Post(ADMIN_ROUTES.USER_REJECT_KYC)` |
| `@Post('users/:id/suspend')` | `@Post(ADMIN_ROUTES.USER_SUSPEND)` |
| `@Post('users/:id/reactivate')` | `@Post(ADMIN_ROUTES.USER_REACTIVATE)` |
| `@Get('payouts/pending')` | `@Get(ADMIN_ROUTES.PAYOUTS_PENDING)` |
| `@Post('orders/:orderId/retry-payout')` | `@Post(ADMIN_ROUTES.ORDER_RETRY_PAYOUT)` |
| `@Post('orders/:orderId/complete-payout')` | `@Post(ADMIN_ROUTES.ORDER_COMPLETE_PAYOUT)` |
| `@Post('auth/login')` | `@Post(ADMIN_ROUTES.AUTH_LOGIN)` |
| `@Post('auth/logout')` | `@Post(ADMIN_ROUTES.AUTH_LOGOUT)` |
| `@Get('me')` | `@Get(ADMIN_ROUTES.ME)` |
| `@Get('team')` | `@Get(ADMIN_ROUTES.TEAM)` |
| `@Post('team')` | `@Post(ADMIN_ROUTES.TEAM)` |
| `@Post('team/:id/deactivate')` | `@Post(ADMIN_ROUTES.TEAM_MEMBER_DEACTIVATE)` |
| `@Post('team/:id/activate')` | `@Post(ADMIN_ROUTES.TEAM_MEMBER_ACTIVATE)` |
| `@Post('team/:id/set-password')` | `@Post(ADMIN_ROUTES.TEAM_MEMBER_SET_PASSWORD)` |

- [ ] **Step 3: Typecheck API workspace**

```bash
yarn workspace vouchrex-api typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/admin/
git commit -m "refactor(api): extract admin route strings into constants"
```

---

## Task 7 — API: Users, Health, Webhooks

**Files:**
- Create: `apps/api/src/modules/users/users.routes.ts`
- Modify: `apps/api/src/modules/users/users.controller.ts`
- Create: `apps/api/src/modules/health/health.routes.ts`
- Modify: `apps/api/src/modules/health/health.controller.ts`
- Create: `apps/api/src/modules/webhooks/webhooks.routes.ts`
- Modify: `apps/api/src/modules/webhooks/webhooks.controller.ts`

- [ ] **Step 1: Create `users/users.routes.ts`**

```ts
export const USERS_ROUTES = {
  BASE: 'users',
} as const;
```

- [ ] **Step 2: Update `users/users.controller.ts`**

Add import after existing imports:
```ts
import { USERS_ROUTES } from './users.routes';
```

Replace decorator string:
| Before | After |
|--------|-------|
| `@Controller('users')` | `@Controller(USERS_ROUTES.BASE)` |

Note: The bare `@Post()` and `@Get()` have no string arguments — leave them as-is.

- [ ] **Step 3: Create `health/health.routes.ts`**

```ts
export const HEALTH_ROUTES = {
  BASE: 'health',
} as const;
```

- [ ] **Step 4: Update `health/health.controller.ts`**

Add import after existing imports:
```ts
import { HEALTH_ROUTES } from './health.routes';
```

Replace decorator string:
| Before | After |
|--------|-------|
| `@Controller('health')` | `@Controller(HEALTH_ROUTES.BASE)` |

Note: The bare `@Get()` has no string argument — leave it as-is.

- [ ] **Step 5: Create `webhooks/webhooks.routes.ts`**

```ts
export const WEBHOOKS_ROUTES = {
  BASE:     'webhooks',
  RAZORPAY: 'razorpay',
} as const;
```

- [ ] **Step 6: Update `webhooks/webhooks.controller.ts`**

Add import after existing imports:
```ts
import { WEBHOOKS_ROUTES } from './webhooks.routes';
```

Replace decorator strings:
| Before | After |
|--------|-------|
| `@Controller('webhooks')` | `@Controller(WEBHOOKS_ROUTES.BASE)` |
| `@Post('razorpay')` | `@Post(WEBHOOKS_ROUTES.RAZORPAY)` |

- [ ] **Step 7: Final typecheck on both workspaces**

```bash
yarn workspace vouchrex-api typecheck && yarn workspace vouchrex-mobile typecheck
```

Expected: no errors from either workspace.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/users/ apps/api/src/modules/health/ apps/api/src/modules/webhooks/
git commit -m "refactor(api): extract users, health, and webhooks route strings into constants"
```
