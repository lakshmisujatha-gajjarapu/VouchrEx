# Realtime Phase 1D — Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten the rough edges identified in the Phase 1A end-to-end review and the spec's Phase 1D scope: socket-reconnect-driven cache reload, race-gating on the remaining `listing.updated` emit sites, and a deep-link safety guard.

**Reference spec:** `docs/superpowers/specs/2026-05-09-realtime-and-push-design.md` (Phase 1D section)

## Out of scope

- Real-device QA matrix (handed off to the user)
- Push receipt polling (Phase 2 / worker)
- Structured push logging is already in place from Phase 1B implementation; no further work

---

## Task 1: Mobile — refetch on socket reconnect

When the Socket.IO client reconnects after a drop, in-flight events are lost. Add a hook that wires every screen using `useAsyncResource` to also call `reload()` when the socket re-establishes.

**Files:**
- Create: `apps/mobile/src/hooks/use-refetch-on-reconnect.ts`
- Modify: `apps/mobile/src/app/(tabs)/shop.tsx`
- Modify: `apps/mobile/src/app/(tabs)/listings.tsx`
- Modify: `apps/mobile/src/app/(tabs)/orders.tsx`
- Modify: `apps/mobile/src/app/(tabs)/inbox.tsx`
- Modify: `apps/mobile/src/app/listings/[id].tsx`
- Modify: `apps/mobile/src/app/orders/[id].tsx`

- [ ] **Step 1: Create the hook**

```ts
// apps/mobile/src/hooks/use-refetch-on-reconnect.ts
import { useEffect } from 'react';
import { useSocket } from './use-socket';

/**
 * Calls `refetch` whenever the socket reconnects after a drop. Used in
 * combination with useRefetchOnFocus to ensure stale screens recover both
 * after backgrounding (focus) and after network blips (reconnect).
 */
export function useRefetchOnReconnect(refetch: () => void) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    let firstConnect = true;
    const onReconnect = () => {
      if (firstConnect) {
        firstConnect = false;
        return;
      }
      refetch();
    };

    socket.on('connect', onReconnect);
    return () => { socket.off('connect', onReconnect); };
  }, [socket, refetch]);
}
```

The "skip first connect" guard prevents a double-fire on initial mount (the resource already loaded once via `useAsyncResource`).

- [ ] **Step 2: Wire into screens that have `useRefetchOnFocus` today**

In each of the 6 screens listed below, add the import and call alongside the existing `useRefetchOnFocus` call. The reload callback is the same one already passed to `useRefetchOnFocus` — pass it to both hooks.

Files to update:
- `apps/mobile/src/app/(tabs)/shop.tsx`
- `apps/mobile/src/app/(tabs)/listings.tsx`
- `apps/mobile/src/app/(tabs)/orders.tsx`
- `apps/mobile/src/app/(tabs)/inbox.tsx`
- `apps/mobile/src/app/listings/[id].tsx`
- `apps/mobile/src/app/orders/[id].tsx`

For each: find the existing `useRefetchOnFocus(...)` call. Add immediately below:

```ts
import { useRefetchOnReconnect } from '@/hooks/use-refetch-on-reconnect';
// ...
useRefetchOnReconnect(/* same callback as useRefetchOnFocus */);
```

For example in `shop.tsx`, if today there's:
```ts
useRefetchOnFocus(useCallback(() => { void listingsResource.reload(); }, [listingsResource.reload]));
```
Add:
```ts
useRefetchOnReconnect(useCallback(() => { void listingsResource.reload(); }, [listingsResource.reload]));
```

(Or extract a single memoized `reload` constant and pass it to both — DRY improvement, optional.)

- [ ] **Step 3: Typecheck and lint**

```bash
yarn workspace vouchrex-mobile typecheck
yarn lint
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/hooks/use-refetch-on-reconnect.ts \
        'apps/mobile/src/app/(tabs)/shop.tsx' \
        'apps/mobile/src/app/(tabs)/listings.tsx' \
        'apps/mobile/src/app/(tabs)/orders.tsx' \
        'apps/mobile/src/app/(tabs)/inbox.tsx' \
        'apps/mobile/src/app/listings/[id].tsx' \
        'apps/mobile/src/app/orders/[id].tsx'
git commit -m "feat(mobile): refetch screens on socket reconnect"
```

---

## Task 2: Server — race-gate the remaining `listing.updated` emit sites

Phase 1A's final review flagged 3 emit sites that don't have race-condition gating like `expireStaleListings` and `cancelStalePaymentPendingOrders`. Today they are safe due to upstream guards, but a future change could break them. Apply the same gating pattern: capture the listing's update count from inside the transaction and only emit when count > 0.

Sites:
1. `OrdersService.createDispute` (around line 700) — sets DISPUTED
2. `OrdersService.initiateDisputeRefund` (around line 866) — sets REFUNDED
3. `OrdersService.cancelExpiredEscrowOrders` (around line 1454) — sets REFUNDED

**Files:**
- Modify: `apps/api/src/modules/orders/orders.service.ts`
- Modify: `apps/api/test/listings.service.test.cjs` (or extend `orders.service.test.cjs` if listing-related tests live there)

- [ ] **Step 1: Read each site and determine the transaction shape**

For each of the 3 sites, the transaction does:
- An order update (which already has its own count gating elsewhere)
- A listing update (which currently fires `listing.updated` unconditionally after the tx)

Refactor the transaction to return both counts (or relevant booleans) and gate the `listing.updated` emit on the listing's count.

- [ ] **Step 2: Apply pattern to `createDispute`**

Find the `prisma.$transaction(async (tx) => { ... })` block in `createDispute`. The current shape is roughly:

```ts
await this.prisma.$transaction(async (tx) => {
  await tx.order.update({ ... });
  await tx.voucherListing.update({ where: { id: order.listingId }, data: { status: ListingStatus.DISPUTED } });
  // ...
});

this.eventEmitter.emit('order.updated', { ... });
this.eventEmitter.emit('dispute.created', { ... });
this.eventEmitter.emit('listing.updated', { listingId: order.listingId, status: 'DISPUTED' });
```

Change to:

```ts
const txResult = await this.prisma.$transaction(async (tx) => {
  await tx.order.update({ ... });
  const listingUpdate = await tx.voucherListing.updateMany({
    where: { id: order.listingId, status: ListingStatus.CODE_REVEALED }, // or whatever the precondition is
    data: { status: ListingStatus.DISPUTED }
  });
  // ... rest of tx
  return { listingTransitioned: listingUpdate.count > 0 };
});

this.eventEmitter.emit('order.updated', { ... });
this.eventEmitter.emit('dispute.created', { ... });
if (txResult.listingTransitioned) {
  this.eventEmitter.emit('listing.updated', { listingId: order.listingId, status: 'DISPUTED' });
}
```

If the existing code uses `tx.voucherListing.update(...)` (single-row throwing API), switch to `updateMany` with the same `where` to get a count without throwing on race. Determine the correct `from` status precondition by reading the validation guard at the top of the function.

- [ ] **Step 3: Apply same pattern to `initiateDisputeRefund` and `cancelExpiredEscrowOrders`**

Both follow the same shape: capture the listing updateMany count from inside the transaction, gate the emit on the count.

- [ ] **Step 4: Add tests**

For one of the three sites (pick the simplest — likely `cancelExpiredEscrowOrders`), add a test that:
- Mocks the transaction so `voucherListing.updateMany` returns `count: 0`
- Asserts no `listing.updated` is emitted
- Mocks again with `count: 1` and asserts emission

The exact test shape depends on the mocking surface required. If the existing test infrastructure makes this expensive, document a "manual inspection checklist" in a code comment instead and skip the test — the change is small and verified by reading.

- [ ] **Step 5: Run tests**

```bash
yarn workspace vouchrex-api test
yarn workspace vouchrex-api typecheck
```

All green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/orders/orders.service.ts apps/api/test/
git commit -m "fix(realtime): race-gate listing.updated emits in dispute and escrow paths"
```

---

## Task 3: Mobile — deep-link safety guard

`router.push(payload.link as never)` in `NotificationCenterProvider` and `subscribeToNotificationTaps` accepts arbitrary strings. Add a guard so only relative `/`-prefixed paths are accepted.

**Files:**
- Modify: `apps/mobile/src/lib/push.ts`
- Modify: `apps/mobile/src/hooks/use-notification-center.tsx`
- Modify: `apps/mobile/src/hooks/use-push-registrar.tsx` (if it directly does `router.push`)

- [ ] **Step 1: Add a shared helper**

Add to `apps/mobile/src/lib/push.ts`:

```ts
/**
 * Validates that a deep-link is a safe relative path (starts with `/` and
 * does not contain `://`). Returns the link or null. Used to prevent a
 * malformed payload from sending the user to an external URL or breaking
 * navigation.
 */
export function safeDeepLink(link: unknown): string | null {
  if (typeof link !== 'string' || link.length === 0) return null;
  if (!link.startsWith('/') || link.includes('://')) return null;
  return link;
}
```

- [ ] **Step 2: Use it in the toast tap handler**

In `apps/mobile/src/hooks/use-notification-center.tsx`, replace:

```ts
onPress: () => {
  if (payload?.link) {
    router.push(payload.link as never);
  }
}
```

with:

```ts
onPress: () => {
  const safeLink = safeDeepLink(payload?.link);
  if (safeLink) router.push(safeLink as never);
}
```

(Add the import: `import { safeDeepLink } from '@/lib/push';`.)

- [ ] **Step 3: Use it in the OS notification tap subscriber**

In `apps/mobile/src/lib/push.ts` `subscribeToNotificationTaps`:

```ts
export function subscribeToNotificationTaps(onTap: (link: string) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const link = safeDeepLink(response.notification.request.content.data?.link);
    if (link) onTap(link);
  });
  return () => { sub.remove(); };
}
```

- [ ] **Step 4: Typecheck + commit**

```bash
yarn workspace vouchrex-mobile typecheck
git add apps/mobile/src/lib/push.ts apps/mobile/src/hooks/use-notification-center.tsx
git commit -m "fix(mobile): guard deep-link payload to relative paths only"
```

---

## Task 4: Smoke verification

```bash
yarn workspace vouchrex-api test
yarn workspace vouchrex-api typecheck
yarn workspace vouchrex-mobile typecheck
yarn workspace vouchrex-admin typecheck
yarn lint
```

All must pass; lint should only show pre-existing msg91 warnings.

No commit needed.

---

## Spec coverage check

| Spec requirement (Phase 1D) | Implemented in |
|---|---|
| Refetch on socket reconnect | Task 1 |
| Race-gate remaining listing.updated emits | Task 2 |
| Deep-link safety guard | Task 3 |
| Smoke verification | Task 4 |
| Real-device QA matrix | Out of scope (user) |
| Structured push logging | Already in place (Phase 1B) |
