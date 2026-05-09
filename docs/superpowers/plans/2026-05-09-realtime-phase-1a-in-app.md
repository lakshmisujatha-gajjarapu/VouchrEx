# Realtime Phase 1A — In-App Realtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile app update live (without pull-to-refresh) for listing creates/updates, order status changes, and notifications, by wiring the existing Socket.IO infrastructure into screens and adding two new server-emitted events.

**Architecture:** Server emits two new domain events (`listing.created`, `listing.updated`) via existing `EventEmitter2`. The existing `RealtimeGateway` adds two `@OnEvent` handlers that broadcast those over Socket.IO to all connected sockets. On the mobile side, two new thin hooks (`useListingsSocket`, `useOrdersListSocket`) plus a new app-level `NotificationCenterProvider` (toast + Inbox unread badge) consume events and call existing `useAsyncResource.reload()` on the affected screens.

**Tech Stack:** NestJS 10, `@nestjs/event-emitter`, `@nestjs/websockets` (Socket.IO), Prisma; React Native / Expo Router, `socket.io-client`, `react-native-toast-message`.

**Reference spec:** `docs/superpowers/specs/2026-05-09-realtime-and-push-design.md`

**File map**

| File | Action | Responsibility |
|---|---|---|
| `apps/api/src/modules/realtime/realtime.gateway.ts` | modify | add `listing.created` / `listing.updated` `@OnEvent` handlers |
| `apps/api/src/modules/listings/listings.service.ts` | modify | inject `EventEmitter2`, emit `listing.created` on create, `listing.updated` on every status mutation site in this file |
| `apps/api/src/modules/listings/listings.module.ts` | modify | confirm `EventEmitterModule` is available (it is, via `app.module.ts`) |
| `apps/api/src/modules/orders/orders.service.ts` | modify | emit `listing.updated` after every site that mutates `voucherListing.status` |
| `apps/api/test/listings.service.test.cjs` | create | unit-test listing event emission |
| `apps/api/test/realtime.gateway.test.cjs` | create | unit-test gateway handlers broadcast correctly |
| `apps/mobile/src/hooks/use-listings-socket.ts` | create | thin event-to-callback bridge for `listing:created` / `listing:updated` |
| `apps/mobile/src/hooks/use-orders-list-socket.ts` | create | thin event-to-callback bridge for any `order:updated` |
| `apps/mobile/src/hooks/use-notification-center.tsx` | create | provider: subscribes once to `notification:new`, exposes `unreadCount`, fires toast |
| `apps/mobile/src/app/_layout.tsx` | modify | wrap with `NotificationCenterProvider`; render `<Toast />` |
| `apps/mobile/src/app/(tabs)/shop.tsx` | modify | wire `useListingsSocket` → reload listings |
| `apps/mobile/src/app/(tabs)/listings.tsx` | modify | wire `useListingsSocket` → reload |
| `apps/mobile/src/app/(tabs)/orders.tsx` | modify | wire `useOrdersListSocket` → reload |
| `apps/mobile/src/app/(tabs)/inbox.tsx` | modify | consume unread count from provider; (already wires `useNotificationsSocket` for list reload) |
| `apps/mobile/src/app/(tabs)/_layout.tsx` | modify | Inbox tab badge from provider unread count |
| `apps/mobile/src/app/listings/[id].tsx` | modify | wire `useListingsSocket` filtered to this `listingId` → reload |
| `apps/mobile/package.json` | modify | add `react-native-toast-message` dependency |

**Out of scope (later phases):** push notifications, admin app, hardening pass, listing-related order side-effects beyond the existing emission sites, dispute/payout events.

---

## Task 1: Server — emit `listing.created` from `ListingsService.create`

**Files:**
- Modify: `apps/api/src/modules/listings/listings.service.ts`
- Test: `apps/api/test/listings.service.test.cjs` (create)

- [ ] **Step 1: Read the existing `ListingsService.create` method**

Read `apps/api/src/modules/listings/listings.service.ts` lines 180–254. Confirm the create method ends by returning `createdListing` after calling `notificationsService.createNotification`. We will inject `EventEmitter2` and emit immediately before the return.

- [ ] **Step 2: Write the failing test for emission on create**

Create `apps/api/test/listings.service.test.cjs`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

require('ts-node/register/transpile-only');

const { ListingsService } = require('../src/modules/listings/listings.service.ts');

test('ListingsService.create emits listing.created with id and sellerId', async () => {
  const emitted = [];

  const prisma = {
    voucherListing: {
      create: async ({ data }) => ({
        id: 'listing_1',
        sellerId: data.sellerId,
        brandId: data.brandId,
        status: 'ACTIVE',
        sellingPrice: data.sellingPrice,
        faceValue: data.faceValue,
        discountPercent: data.discountPercent,
        expiryDate: data.expiryDate,
        brand: { id: data.brandId, name: 'Amazon' },
        seller: { id: data.sellerId, name: 'Priya' }
      })
    }
  };

  const codeVault = { encrypt: () => ({ encryptedCode: 'c', encryptionIv: 'i', encryptionTag: 't' }) };
  const notifications = { createNotification: async () => ({}) };
  const brands = {
    findOrCreateForListing: async () => ({ id: 'brand_1', name: 'Amazon' })
  };
  const payouts = { ensureSellerHasPayoutAccount: async () => ({}) };
  const eventEmitter = { emit: (eventType, payload) => { emitted.push({ eventType, payload }); } };

  const service = new ListingsService(prisma, codeVault, notifications, brands, payouts, eventEmitter);

  await service.create(
    { id: 'seller_1', name: 'Priya' },
    {
      brandName: 'Amazon',
      voucherType: 'GIFT_CARD',
      faceValue: 500,
      sellingPrice: 450,
      voucherCode: 'AMZ123',
      expiryDate: new Date(Date.now() + 86_400_000).toISOString()
    }
  );

  const created = emitted.find(e => e.eventType === 'listing.created');
  assert.ok(created, 'expected a listing.created emission');
  assert.equal(created.payload.listingId, 'listing_1');
  assert.equal(created.payload.sellerId, 'seller_1');
});
```

- [ ] **Step 3: Run the test, expect it to fail**

Run: `yarn workspace @cb/api test --test-name-pattern="emits listing.created"`
Expected: FAIL — `ListingsService` constructor takes 5 args today, our test passes 6. Or, if construction succeeds, the assertion fails because no emission happens.

- [ ] **Step 4: Inject `EventEmitter2` into `ListingsService`**

In `apps/api/src/modules/listings/listings.service.ts`, modify the imports and constructor:

```ts
import { EventEmitter2 } from '@nestjs/event-emitter';
```

Update the constructor:

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly codeVaultService: CodeVaultService,
  private readonly notificationsService: NotificationsService,
  private readonly brandsService: BrandsService,
  private readonly payoutAccountsService: PayoutAccountsService,
  private readonly eventEmitter: EventEmitter2
) {}
```

- [ ] **Step 5: Emit `listing.created` after the listing is created**

In `apps/api/src/modules/listings/listings.service.ts`, in the `create` method, immediately before `return createdListing;`:

```ts
this.eventEmitter.emit('listing.created', {
  listingId: createdListing.id,
  sellerId: createdListing.sellerId,
  brandId: createdListing.brandId,
  status: createdListing.status
});
```

- [ ] **Step 6: Run the test, expect it to pass**

Run: `yarn workspace @cb/api test --test-name-pattern="emits listing.created"`
Expected: PASS.

- [ ] **Step 7: Run full API typecheck**

Run: `yarn workspace @cb/api typecheck`
Expected: no errors. (`EventEmitterModule` is already imported globally in `app.module.ts`, so no module wiring is needed.)

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/listings/listings.service.ts apps/api/test/listings.service.test.cjs
git commit -m "feat(realtime): emit listing.created from ListingsService"
```

---

## Task 2: Server — emit `listing.updated` from every status mutation site

The spec requires `listing.updated` whenever a listing's status changes. The current code mutates `voucherListing.status` in these locations:

- `apps/api/src/modules/listings/listings.service.ts:380` — expire (sets `EXPIRED`)
- `apps/api/src/modules/listings/listings.service.ts:369` — re-activate from edit (sets `ACTIVE`)
- `apps/api/src/modules/orders/orders.service.ts:203` — order created (sets `RESERVED`)
- `apps/api/src/modules/orders/orders.service.ts:275` — order canceled (sets `ACTIVE`)
- `apps/api/src/modules/orders/orders.service.ts:639` — dispute opened (sets `DISPUTED`)
- `apps/api/src/modules/orders/orders.service.ts:820` — refund (sets `REFUNDED`)
- `apps/api/src/modules/orders/orders.service.ts:1274–1275` — auto-reset on timeout (sets `ACTIVE`)
- `apps/api/src/modules/orders/orders.service.ts:1389` — refund variant (sets `REFUNDED`)
- `apps/api/src/modules/orders/orders.service.ts:1588` — payment confirmed (sets `SOLD`)

We add one `eventEmitter.emit('listing.updated', { listingId, status })` call after each of those mutations.

**Files:**
- Modify: `apps/api/src/modules/listings/listings.service.ts`
- Modify: `apps/api/src/modules/orders/orders.service.ts`
- Test: `apps/api/test/listings.service.test.cjs` (extend)

- [ ] **Step 1: Add a failing test for `listing.updated` on listings.service.expire**

Append to `apps/api/test/listings.service.test.cjs`:

```js
test('ListingsService.expire emits listing.updated with EXPIRED status', async () => {
  const emitted = [];
  const prisma = {
    voucherListing: {
      findUnique: async () => ({ id: 'listing_2', sellerId: 'seller_1', status: 'ACTIVE' }),
      update: async ({ data }) => ({ id: 'listing_2', status: data.status })
    }
  };
  const eventEmitter = { emit: (eventType, payload) => { emitted.push({ eventType, payload }); } };

  const service = new ListingsService(
    prisma,
    { encrypt: () => ({}) },
    { createNotification: async () => ({}) },
    { findOrCreateForListing: async () => ({}) },
    { ensureSellerHasPayoutAccount: async () => ({}) },
    eventEmitter
  );

  await service.expire('listing_2');

  const updated = emitted.find(e => e.eventType === 'listing.updated');
  assert.ok(updated, 'expected a listing.updated emission');
  assert.equal(updated.payload.listingId, 'listing_2');
  assert.equal(updated.payload.status, 'EXPIRED');
});
```

- [ ] **Step 2: Run the test, expect it to fail**

Run: `yarn workspace @cb/api test --test-name-pattern="listing.updated with EXPIRED"`
Expected: FAIL — no `listing.updated` is emitted yet.

- [ ] **Step 3: Add emission in `ListingsService.expire`**

In `apps/api/src/modules/listings/listings.service.ts`, locate the line `data: { status: ListingStatus.EXPIRED }` (around line 380). Immediately after the `update` call returns, add:

```ts
this.eventEmitter.emit('listing.updated', {
  listingId: updatedListing.id,
  status: updatedListing.status
});
```

If the local variable for the update result isn't named `updatedListing`, rename it for clarity (or use the existing name).

- [ ] **Step 4: Run the test, expect it to pass**

Run: `yarn workspace @cb/api test --test-name-pattern="listing.updated with EXPIRED"`
Expected: PASS.

- [ ] **Step 5: Add emission in the listings re-activate path (around line 369)**

In the same file, locate the other `status: ListingStatus.ACTIVE` write inside an update call (the path that re-activates a listing during edit). After that update returns, add:

```ts
this.eventEmitter.emit('listing.updated', {
  listingId: result.id,
  status: result.status
});
```

(Use whatever variable name holds the update result.)

- [ ] **Step 6: Inject `EventEmitter2` into `OrdersService` (if not already)**

Check `apps/api/src/modules/orders/orders.service.ts` line 8 — it already imports `EventEmitter2`. Confirm the constructor parameter exists at line 45. No change needed if so. If missing, add it identically to the listings change.

- [ ] **Step 7: Add `listing.updated` emissions in `OrdersService` at every status-mutation site**

In `apps/api/src/modules/orders/orders.service.ts`, after each of the following Prisma updates that change `voucherListing.status`, emit:

```ts
this.eventEmitter.emit('listing.updated', {
  listingId: <listingId-in-scope>,
  status: <new-status-literal-or-from-result>
});
```

Sites to instrument (line numbers from the spec snapshot, verify before editing):
- Line 203 area — sets `RESERVED` after order created
- Line 275 area — sets `ACTIVE` after order canceled
- Line 639 area — sets `DISPUTED` on dispute open
- Line 820 area — sets `REFUNDED` on refund
- Lines 1274–1275 area — sets `ACTIVE` on auto-reset
- Line 1389 area — sets `REFUNDED` on refund variant
- Line 1588 area — sets `SOLD` on payment confirmed

Use the listing ID from the surrounding scope (typically `order.listingId` or `listing.id`).

- [ ] **Step 8: Run the full API test suite**

Run: `yarn workspace @cb/api test`
Expected: PASS. Existing orders/listings tests still green; new tests green.

- [ ] **Step 9: Run typecheck and lint**

Run: `yarn workspace @cb/api typecheck && yarn workspace @cb/api lint`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/modules/listings/listings.service.ts \
        apps/api/src/modules/orders/orders.service.ts \
        apps/api/test/listings.service.test.cjs
git commit -m "feat(realtime): emit listing.updated on every status mutation"
```

---

## Task 3: Server — broadcast `listing.*` events over Socket.IO

**Files:**
- Modify: `apps/api/src/modules/realtime/realtime.gateway.ts`
- Test: `apps/api/test/realtime.gateway.test.cjs` (create)

- [ ] **Step 1: Write the failing test for the gateway broadcast handlers**

Create `apps/api/test/realtime.gateway.test.cjs`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

require('ts-node/register/transpile-only');

const { RealtimeGateway } = require('../src/modules/realtime/realtime.gateway.ts');

function makeServer() {
  const emissions = [];
  return {
    emissions,
    server: {
      emit: (event, data) => { emissions.push({ scope: 'broadcast', event, data }); },
      to: (room) => ({
        emit: (event, data) => { emissions.push({ scope: room, event, data }); }
      })
    }
  };
}

test('RealtimeGateway broadcasts listing.created to all sockets as listing:created', () => {
  const { emissions, server } = makeServer();
  const gateway = new RealtimeGateway({ getSessionUser: async () => null });
  gateway.server = server;

  gateway.handleListingCreated({ listingId: 'l1', sellerId: 's1', brandId: 'b1', status: 'ACTIVE' });

  assert.deepEqual(emissions, [{
    scope: 'broadcast',
    event: 'listing:created',
    data: { listingId: 'l1', sellerId: 's1', brandId: 'b1', status: 'ACTIVE' }
  }]);
});

test('RealtimeGateway broadcasts listing.updated as listing:updated', () => {
  const { emissions, server } = makeServer();
  const gateway = new RealtimeGateway({ getSessionUser: async () => null });
  gateway.server = server;

  gateway.handleListingUpdated({ listingId: 'l1', status: 'SOLD' });

  assert.deepEqual(emissions, [{
    scope: 'broadcast',
    event: 'listing:updated',
    data: { listingId: 'l1', status: 'SOLD' }
  }]);
});
```

- [ ] **Step 2: Run the test, expect it to fail**

Run: `yarn workspace @cb/api test --test-name-pattern="RealtimeGateway broadcasts"`
Expected: FAIL — `gateway.handleListingCreated` is undefined.

- [ ] **Step 3: Add the broadcast handlers and payload types to the gateway**

In `apps/api/src/modules/realtime/realtime.gateway.ts`, add these payload types near the existing `OrderUpdatedEvent`:

```ts
export type ListingCreatedEvent = {
  readonly listingId: string;
  readonly sellerId: string;
  readonly brandId: string;
  readonly status: string;
};

export type ListingUpdatedEvent = {
  readonly listingId: string;
  readonly status: string;
};
```

Add two methods inside the `RealtimeGateway` class:

```ts
@OnEvent('listing.created')
handleListingCreated(payload: ListingCreatedEvent) {
  this.server.emit('listing:created', payload);
}

@OnEvent('listing.updated')
handleListingUpdated(payload: ListingUpdatedEvent) {
  this.server.emit('listing:updated', payload);
}
```

- [ ] **Step 4: Run the test, expect it to pass**

Run: `yarn workspace @cb/api test --test-name-pattern="RealtimeGateway broadcasts"`
Expected: PASS (both subtests).

- [ ] **Step 5: Run full API tests + typecheck + lint**

Run: `yarn workspace @cb/api test && yarn workspace @cb/api typecheck && yarn workspace @cb/api lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/realtime/realtime.gateway.ts apps/api/test/realtime.gateway.test.cjs
git commit -m "feat(realtime): broadcast listing:created and listing:updated over socket"
```

---

## Task 4: Mobile — add `useListingsSocket` and `useOrdersListSocket` hooks

**Files:**
- Create: `apps/mobile/src/hooks/use-listings-socket.ts`
- Create: `apps/mobile/src/hooks/use-orders-list-socket.ts`

- [ ] **Step 1: Create `useListingsSocket`**

Create `apps/mobile/src/hooks/use-listings-socket.ts`:

```ts
import { useEffect } from 'react';
import { useSocket } from './use-socket';

export type ListingCreatedPayload = {
  readonly listingId: string;
  readonly sellerId: string;
  readonly brandId: string;
  readonly status: string;
};

export type ListingUpdatedPayload = {
  readonly listingId: string;
  readonly status: string;
};

type Handlers = {
  readonly onCreated?: (payload: ListingCreatedPayload) => void;
  readonly onUpdated?: (payload: ListingUpdatedPayload) => void;
};

/**
 * Subscribes to listing:created and listing:updated socket events.
 * Callbacks should be memoized by the caller (useCallback).
 */
export function useListingsSocket({ onCreated, onUpdated }: Handlers) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    if (onCreated) socket.on('listing:created', onCreated);
    if (onUpdated) socket.on('listing:updated', onUpdated);

    return () => {
      if (onCreated) socket.off('listing:created', onCreated);
      if (onUpdated) socket.off('listing:updated', onUpdated);
    };
  }, [socket, onCreated, onUpdated]);
}
```

- [ ] **Step 2: Create `useOrdersListSocket`**

Create `apps/mobile/src/hooks/use-orders-list-socket.ts`:

```ts
import { useEffect } from 'react';
import { useSocket } from './use-socket';

/**
 * Calls the callback whenever any order:updated event arrives. Use this on
 * list screens that need to refresh when any of the user's orders change.
 * For a single-order screen, use useOrderSocket instead.
 */
export function useOrdersListSocket(onAnyOrderUpdated: () => void) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on('order:updated', onAnyOrderUpdated);
    return () => { socket.off('order:updated', onAnyOrderUpdated); };
  }, [socket, onAnyOrderUpdated]);
}
```

- [ ] **Step 3: Mobile typecheck**

Run: `yarn workspace @cb/mobile typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/hooks/use-listings-socket.ts apps/mobile/src/hooks/use-orders-list-socket.ts
git commit -m "feat(mobile): add useListingsSocket and useOrdersListSocket hooks"
```

---

## Task 5: Mobile — install `react-native-toast-message`

**Files:**
- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Add the dependency**

Run from repo root:

```bash
yarn workspace @cb/mobile add react-native-toast-message
```

- [ ] **Step 2: Verify the lockfile updated**

Run: `git status apps/mobile/package.json yarn.lock`
Expected: both files modified, no other changes.

- [ ] **Step 3: Mobile typecheck**

Run: `yarn workspace @cb/mobile typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json yarn.lock
git commit -m "chore(mobile): add react-native-toast-message dependency"
```

---

## Task 6: Mobile — add `NotificationCenterProvider` (toast + unread count)

**Files:**
- Create: `apps/mobile/src/hooks/use-notification-center.tsx`

- [ ] **Step 1: Create the provider**

Create `apps/mobile/src/hooks/use-notification-center.tsx`:

```tsx
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';

import { useSocket } from './use-socket';

type IncomingNotification = {
  readonly id?: string;
  readonly title?: string;
  readonly message?: string;
  readonly link?: string;
};

type NotificationCenterValue = {
  readonly unreadCount: number;
  readonly markAllRead: () => void;
};

const NotificationCenterContext = createContext<NotificationCenterValue>({
  unreadCount: 0,
  markAllRead: () => {}
});

export function NotificationCenterProvider({ children }: { readonly children: React.ReactNode }) {
  const { socket } = useSocket();
  const [unreadCount, setUnreadCount] = useState(0);

  const handleNew = useCallback((payload: IncomingNotification | undefined) => {
    setUnreadCount((n) => n + 1);

    Toast.show({
      type: 'info',
      text1: payload?.title ?? 'New notification',
      text2: payload?.message,
      onPress: () => {
        if (payload?.link) {
          router.push(payload.link as never);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('notification:new', handleNew);
    return () => { socket.off('notification:new', handleNew); };
  }, [socket, handleNew]);

  const markAllRead = useCallback(() => { setUnreadCount(0); }, []);

  return (
    <NotificationCenterContext.Provider value={{ unreadCount, markAllRead }}>
      {children}
    </NotificationCenterContext.Provider>
  );
}

export function useNotificationCenter() {
  return useContext(NotificationCenterContext);
}
```

> **Note:** the existing `useNotificationsSocket(cb)` (used by `inbox.tsx`) accepts a no-arg callback and discards the payload. This provider needs the payload (title/message/link), so it subscribes directly to the socket. Both subscriptions can coexist — Socket.IO supports multiple listeners per event.

- [ ] **Step 2: Mobile typecheck**

Run: `yarn workspace @cb/mobile typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/hooks/use-notification-center.tsx
git commit -m "feat(mobile): add NotificationCenterProvider with toast + unread count"
```

---

## Task 7: Mobile — wire provider and `<Toast />` into the root layout

**Files:**
- Modify: `apps/mobile/src/app/_layout.tsx`

- [ ] **Step 1: Read the current `_layout.tsx`**

Read `apps/mobile/src/app/_layout.tsx`. Locate the `InnerApp` function — currently `ThemeProvider > AuthProvider > SocketProvider > AppStack`.

- [ ] **Step 2: Wrap with `NotificationCenterProvider` and render `<Toast />`**

Modify `InnerApp` to:

```tsx
import Toast from 'react-native-toast-message';
import { NotificationCenterProvider } from '@/hooks/use-notification-center';

function InnerApp() {
  const { preference } = useThemePreference();

  return (
    <ThemeProvider preference={preference}>
      <AuthProvider>
        <SocketProvider>
          <NotificationCenterProvider>
            <AppStack />
            <Toast />
          </NotificationCenterProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
```

`<Toast />` must be rendered **inside** the providers but as a sibling to `<AppStack />` so it overlays everything.

- [ ] **Step 3: Mobile typecheck**

Run: `yarn workspace @cb/mobile typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/app/_layout.tsx
git commit -m "feat(mobile): mount NotificationCenterProvider and Toast at root"
```

---

## Task 8: Mobile — Inbox tab badge from unread count

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/_layout.tsx`
- Modify: `apps/mobile/src/app/(tabs)/inbox.tsx`

- [ ] **Step 1: Read the tabs layout**

Read `apps/mobile/src/app/(tabs)/_layout.tsx`. Identify how the Inbox tab is configured (likely via Expo Router `Tabs.Screen` with `tabBarBadge`).

- [ ] **Step 2: Wire the badge**

In `apps/mobile/src/app/(tabs)/_layout.tsx`, import the hook and read the count:

```tsx
import { useNotificationCenter } from '@/hooks/use-notification-center';
```

Inside the component that renders `<Tabs>`, call:

```tsx
const { unreadCount } = useNotificationCenter();
```

On the Inbox `Tabs.Screen`, set:

```tsx
tabBarBadge: unreadCount > 0 ? unreadCount : undefined
```

- [ ] **Step 3: Mark all read when Inbox is focused**

In `apps/mobile/src/app/(tabs)/inbox.tsx`, add at the top of the component body:

```tsx
import { useFocusEffect } from 'expo-router';
import { useNotificationCenter } from '@/hooks/use-notification-center';

const { markAllRead } = useNotificationCenter();
useFocusEffect(useCallback(() => { markAllRead(); }, [markAllRead]));
```

- [ ] **Step 4: Mobile typecheck**

Run: `yarn workspace @cb/mobile typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/app/\(tabs\)/_layout.tsx apps/mobile/src/app/\(tabs\)/inbox.tsx
git commit -m "feat(mobile): wire Inbox tab badge to notification center unread count"
```

---

## Task 9: Mobile — wire `useListingsSocket` into Bazaar (`shop.tsx`)

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/shop.tsx`

- [ ] **Step 1: Read `shop.tsx` around `listingsResource`**

Read lines 180–200 of `apps/mobile/src/app/(tabs)/shop.tsx`. Confirm there's a `listingsResource = useAsyncResource(...)`.

- [ ] **Step 2: Add the socket subscription**

Add imports:

```tsx
import { useCallback } from 'react';
import { useListingsSocket } from '@/hooks/use-listings-socket';
```

After the line that creates `listingsResource`, add:

```tsx
const reloadListings = useCallback(() => { void listingsResource.reload(); }, [listingsResource]);
useListingsSocket({ onCreated: reloadListings, onUpdated: reloadListings });
```

- [ ] **Step 3: Mobile typecheck**

Run: `yarn workspace @cb/mobile typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/app/\(tabs\)/shop.tsx
git commit -m "feat(mobile): refresh Bazaar feed live on listing events"
```

---

## Task 10: Mobile — wire `useListingsSocket` into `(tabs)/listings.tsx`

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/listings.tsx`

> The `(tabs)/sell.tsx` file is the new-listing form (only `suggestionsResource`, no listings list). It does not need a socket subscription. The "my listings" view lives in `listings.tsx`.

- [ ] **Step 1: Patch `listings.tsx`**

In `apps/mobile/src/app/(tabs)/listings.tsx`, after the `listingsResource = useAsyncResource(...)` line (around line 222), add:

```tsx
import { useListingsSocket } from '@/hooks/use-listings-socket';

const reloadListings = useCallback(() => { void listingsResource.reload(); }, [listingsResource]);
useListingsSocket({ onCreated: reloadListings, onUpdated: reloadListings });
```

(`useCallback` is already imported in this file.)

- [ ] **Step 2: Mobile typecheck**

Run: `yarn workspace @cb/mobile typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/app/\(tabs\)/listings.tsx
git commit -m "feat(mobile): refresh my-listings tab live on listing events"
```

---

## Task 11: Mobile — wire `useOrdersListSocket` into Orders tab

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/orders.tsx`

- [ ] **Step 1: Patch `orders.tsx`**

In `apps/mobile/src/app/(tabs)/orders.tsx`, after `ordersResource = useAsyncResource(...)` (around line 63), add:

```tsx
import { useOrdersListSocket } from '@/hooks/use-orders-list-socket';

const reloadOrders = useCallback(() => { void ordersResource.reload(); }, [ordersResource]);
useOrdersListSocket(reloadOrders);
```

(`useCallback` is already imported.)

- [ ] **Step 2: Mobile typecheck**

Run: `yarn workspace @cb/mobile typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/app/\(tabs\)/orders.tsx
git commit -m "feat(mobile): refresh Orders tab live on order:updated events"
```

---

## Task 12: Mobile — wire `useListingsSocket` into listing detail screen

**Files:**
- Modify: `apps/mobile/src/app/listings/[id].tsx`

- [ ] **Step 1: Patch the listing detail**

In `apps/mobile/src/app/listings/[id].tsx`, after `listingResource = useAsyncResource(...)` (around line 33), add:

```tsx
import { useCallback } from 'react'; // if not already imported
import { useListingsSocket } from '@/hooks/use-listings-socket';

const reload = useCallback(() => { void listingResource.reload(); }, [listingResource]);
useListingsSocket({
  onUpdated: useCallback((payload) => {
    if (payload.listingId === id) reload();
  }, [id, reload])
});
```

(`id` is the route param — confirm its variable name in this file; rename if different.)

- [ ] **Step 2: Mobile typecheck**

Run: `yarn workspace @cb/mobile typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/app/listings/\[id\].tsx
git commit -m "feat(mobile): refresh listing detail live on listing:updated"
```

---

## Task 13: End-to-end manual verification

**Files:** none (manual QA)

- [ ] **Step 1: Start the infra and API**

```bash
make infra-up
make api-dev
```

- [ ] **Step 2: Start the mobile app on a real device or simulator**

```bash
make mobile-dev
```

Pick iOS or Android. Sign in with a test account.

- [ ] **Step 3: Verify Bazaar updates live on listing creation**

In a second terminal, create a listing via the API (using `swagger` UI at `http://localhost:3010/docs` or a known seller's session token):

```bash
curl -X POST http://localhost:3010/listings \
  -H 'Content-Type: application/json' \
  -H 'x-session-token: <SELLER_TOKEN>' \
  -d '{"brandName":"Amazon","voucherType":"GIFT_CARD","faceValue":500,"sellingPrice":450,"voucherCode":"AMZ-NEW-001","expiryDate":"2027-01-01T00:00:00.000Z"}'
```

In the mobile Bazaar/shop tab, the new listing should appear within ~1 second without pull-to-refresh.

- [ ] **Step 4: Verify Bazaar removes a listing when sold**

While viewing the Bazaar, place an order on a visible listing as a different user. The listing's status flips to `RESERVED`, then `SOLD` after payment. The card should disappear or update its status badge live.

- [ ] **Step 5: Verify Orders tab refreshes on status change**

As the buyer, with the Orders tab open, trigger a status change (reveal the code, confirm, etc.). The Orders list must update without manual refresh.

- [ ] **Step 6: Verify in-app toast and Inbox badge on `notification:new`**

Trigger any flow that creates an in-app notification (place an order, or have admin send one). With the app open on any tab, you should see:
  - A toast appear briefly with the title + message
  - The Inbox tab badge increment
  - Tapping the toast navigates to the linked screen
  - Opening the Inbox tab clears the badge

- [ ] **Step 7: Verify reconnection behavior**

Toggle the device's airplane mode for 5 seconds, turn it off. The socket reconnects automatically. Subsequent events should still flow.

- [ ] **Step 8: No commit needed for manual verification**

If any step fails, file an inline fix in the relevant earlier task, re-test, then move on. Otherwise, Phase 1A is complete.

---

## Spec coverage check

| Spec requirement | Implemented in |
|---|---|
| Server emits `listing:created` | Tasks 1, 3 |
| Server emits `listing:updated` from every status site | Tasks 2, 3 |
| Existing `order:updated` and `notification:new` events | already in main, no change |
| Mobile `useListingsSocket` hook | Task 4 |
| Mobile `useOrdersListSocket` hook | Task 4 |
| App-level `NotificationCenterProvider` (toast + badge) | Tasks 5, 6, 7 |
| Inbox tab badge | Task 8 |
| Bazaar live update | Task 9 |
| Listings tab live update | Task 10 |
| Orders tab live update | Task 11 |
| Listing detail live update | Task 12 |
| Order detail live update | already wired via existing `useOrderSocket` |
| Inbox screen list refresh | already wired via existing `useNotificationsSocket` in `inbox.tsx` |
| End-to-end QA | Task 13 |
