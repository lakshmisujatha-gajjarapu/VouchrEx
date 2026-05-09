# Realtime Phase 1C — Admin App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin dashboard pages (orders / disputes / payouts) refresh live without manual reload, and unread dispute alerts flash the browser tab title.

**Architecture:** Extend `RealtimeGateway.handleConnection` to also accept admin tokens (validated via `AdminAccessService`), joining a single `admin` socket room. Extend the existing `handleOrderUpdated` to broadcast to the `admin` room in addition to per-user rooms. Add one new event (`dispute:opened`) for the tab-title flash UX. On the admin (Next.js 16, server-rendered) side, a single `RealtimeBridge` client component receives the admin token via prop from the server layout, opens a Socket.IO connection, and calls `router.refresh()` to re-fetch server-component data on relevant events.

**Tech Stack:** NestJS, Socket.IO, Next.js 16 (server components + client wrapper), `socket.io-client`, `sonner` (toast for shadcn/Tailwind apps).

**Reference spec:** `docs/superpowers/specs/2026-05-09-realtime-and-push-design.md` (Phase 1C section)

## File map

| File | Action | Responsibility |
|---|---|---|
| `apps/api/src/modules/realtime/realtime.module.ts` | modify | add `AdminAccessService` import path (via AdminModule) |
| `apps/api/src/modules/realtime/realtime.gateway.ts` | modify | accept admin tokens, join `admin` room; emit order.updated to admin; new `dispute.created` handler |
| `apps/api/src/modules/orders/orders.service.ts` | modify | emit `dispute.created` event to EventEmitter2 in `createDispute` |
| `apps/api/test/realtime.gateway.test.cjs` | modify | extend with admin-room tests |
| `apps/admin/package.json` | modify | add `socket.io-client`, `sonner` |
| `apps/admin/lib/admin-token.ts` | create | server-only helper to read the admin cookie |
| `apps/admin/components/realtime-bridge.tsx` | create | client component: socket + router.refresh + tab flash |
| `apps/admin/components/toast-host.tsx` | create | mounts `<Toaster />` from sonner |
| `apps/admin/app/layout.tsx` | modify | mount `RealtimeBridge` and `Toaster`, pass admin token from cookie |

## Out of scope (Phase 1D)

- Per-admin filtering
- Web Push delivery
- Reconnect-with-backfill logic
- Logging/observability hardening

---

## Task 1: Server — gateway accepts admin tokens, joins `admin` room

**Files:**
- Modify: `apps/api/src/modules/realtime/realtime.gateway.ts`
- Modify: `apps/api/src/modules/realtime/realtime.module.ts`
- Modify: `apps/api/test/realtime.gateway.test.cjs`

- [ ] **Step 1: Read current gateway and module**

Read `apps/api/src/modules/realtime/realtime.gateway.ts` and `apps/api/src/modules/realtime/realtime.module.ts`.

The gateway currently:
- `handleConnection(socket)` reads `socket.handshake.auth.token`, calls `authService.getSessionUser(token)`, joins `user:{id}` room or disconnects on failure.

We need:
- If `getSessionUser` returns null, attempt admin validation via `AdminAccessService.resolveIdentity(token)` (the non-throwing helper that returns `AdminIdentity | null`).
- If admin valid, `socket.join('admin')`. Else disconnect.

- [ ] **Step 2: Inject `AdminAccessService`**

In `apps/api/src/modules/realtime/realtime.gateway.ts`, add to imports:
```ts
import { AdminAccessService } from '../admin/admin-access.service';
```

Update the constructor:
```ts
constructor(
  private readonly authService: AuthService,
  private readonly adminAccessService: AdminAccessService
) {}
```

- [ ] **Step 3: Update `handleConnection`**

Replace the existing `handleConnection` body:

```ts
async handleConnection(socket: Socket) {
  const token = socket.handshake.auth['token'] as string | undefined;
  if (!token) {
    socket.disconnect(true);
    return;
  }

  const user = await this.authService.getSessionUser(token);
  if (user) {
    (socket.data as Record<string, unknown>)['userId'] = user.id;
    await socket.join(`user:${user.id}`);
    return;
  }

  const adminIdentity = await this.adminAccessService.resolveIdentity(token);
  if (adminIdentity) {
    (socket.data as Record<string, unknown>)['adminId'] = adminIdentity.id;
    await socket.join('admin');
    return;
  }

  socket.disconnect(true);
}
```

> NOTE: `AdminAccessService.resolveIdentity` is private in the current code (used only internally by `requireAdminAccess`). If it is private, change its visibility to `public` (or `internal`) — that's a one-character change and is justified by this new external consumer. If it doesn't exist with that exact name, find the equivalent non-throwing validation method and use it. As a last resort, you can do a defensive comparison: `if (token === process.env.ADMIN_API_TOKEN?.trim())` then admin → but this drops AdminUser session support. Prefer using the service.

- [ ] **Step 4: Wire `AdminAccessService` into the module**

Read `apps/api/src/modules/admin/admin.module.ts`. Confirm `AdminAccessService` is exported. If not, add it to the module's `exports` array.

In `apps/api/src/modules/realtime/realtime.module.ts`, add import:
```ts
imports: [AuthModule, AdminModule]
```

Take care to avoid circular dependencies — if `AdminModule` imports `RealtimeModule` (it shouldn't), use `forwardRef`.

- [ ] **Step 5: Extend the gateway test**

Append to `apps/api/test/realtime.gateway.test.cjs` (use the existing `makeServer` helper if accessible, otherwise inline):

```js
test('RealtimeGateway joins admin room when token validates as admin', async () => {
  const adminAccessService = {
    resolveIdentity: async (t) => (t === 'admintok' ? { id: 'a1', role: 'ADMIN' } : null)
  };
  const authService = { getSessionUser: async () => null };
  const gateway = new RealtimeGateway(authService, adminAccessService);

  const joinedRooms = [];
  const socket = {
    handshake: { auth: { token: 'admintok' } },
    data: {},
    join: async (room) => { joinedRooms.push(room); },
    disconnect: () => { joinedRooms.push('DISCONNECT'); }
  };

  await gateway.handleConnection(socket);

  assert.deepEqual(joinedRooms, ['admin']);
});

test('RealtimeGateway disconnects when token is neither user nor admin', async () => {
  const gateway = new RealtimeGateway(
    { getSessionUser: async () => null },
    { resolveIdentity: async () => null }
  );

  const events = [];
  const socket = {
    handshake: { auth: { token: 'bad' } },
    data: {},
    join: async (room) => { events.push(`join:${room}`); },
    disconnect: () => { events.push('disconnect'); }
  };

  await gateway.handleConnection(socket);
  assert.deepEqual(events, ['disconnect']);
});
```

- [ ] **Step 6: Run tests**

```bash
yarn workspace vouchrex-api test
yarn workspace vouchrex-api typecheck
```

All pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/realtime/realtime.gateway.ts \
        apps/api/src/modules/realtime/realtime.module.ts \
        apps/api/src/modules/admin/admin.module.ts \
        apps/api/src/modules/admin/admin-access.service.ts \
        apps/api/test/realtime.gateway.test.cjs
git commit -m "feat(realtime): authenticate admin sockets and join admin room"
```

---

## Task 2: Server — broadcast `order:updated` to admin room

**Files:**
- Modify: `apps/api/src/modules/realtime/realtime.gateway.ts`
- Modify: `apps/api/test/realtime.gateway.test.cjs`

- [ ] **Step 1: Update `handleOrderUpdated`**

Add one line to the existing handler so that order updates also fan out to the `admin` room:

```ts
@OnEvent('order.updated')
handleOrderUpdated(payload: OrderUpdatedEvent) {
  const data = { orderId: payload.orderId, status: payload.status };
  this.server.to(`user:${payload.buyerId}`).emit('order:updated', data);
  this.server.to(`user:${payload.sellerId}`).emit('order:updated', data);
  this.server.to('admin').emit('order:updated', data);
}
```

- [ ] **Step 2: Add a test**

Append:

```js
test('RealtimeGateway emits order:updated to admin room as well', () => {
  const { emissions, server } = makeServer();
  const gateway = new RealtimeGateway(
    { getSessionUser: async () => null },
    { resolveIdentity: async () => null }
  );
  gateway.server = server;

  gateway.handleOrderUpdated({ buyerId: 'b1', sellerId: 's1', orderId: 'o1', status: 'CONFIRMED' });

  const adminEmit = emissions.find(e => e.scope === 'admin');
  assert.ok(adminEmit, 'expected an admin-room emit');
  assert.equal(adminEmit.event, 'order:updated');
  assert.deepEqual(adminEmit.data, { orderId: 'o1', status: 'CONFIRMED' });
});
```

- [ ] **Step 3: Run tests + commit**

```bash
yarn workspace vouchrex-api test
git add apps/api/src/modules/realtime/realtime.gateway.ts apps/api/test/realtime.gateway.test.cjs
git commit -m "feat(realtime): broadcast order:updated to admin room"
```

---

## Task 3: Server — emit `dispute.created` and route to admin

**Files:**
- Modify: `apps/api/src/modules/orders/orders.service.ts`
- Modify: `apps/api/src/modules/realtime/realtime.gateway.ts`
- Modify: `apps/api/test/realtime.gateway.test.cjs`

- [ ] **Step 1: Emit `dispute.created` from `OrdersService.createDispute`**

Read `apps/api/src/modules/orders/orders.service.ts` around line 597 — the `createDispute` method already emits `order.updated` (line ~696) after the transaction. Add a second emission immediately after:

```ts
this.eventEmitter.emit('dispute.created', {
  orderId: order.id,
  listingId: order.listingId,
  buyerId: order.buyerId,
  sellerId: order.sellerId,
  raisedByUserId: raisedByUserId
});
```

(Adjust field references to match the actual variables in scope.)

- [ ] **Step 2: Add gateway handler**

Add to `apps/api/src/modules/realtime/realtime.gateway.ts`:

```ts
export type DisputeCreatedEvent = {
  readonly orderId: string;
  readonly listingId: string;
  readonly buyerId: string;
  readonly sellerId: string;
  readonly raisedByUserId: string;
};

@OnEvent('dispute.created')
handleDisputeCreated(payload: DisputeCreatedEvent) {
  this.server.to('admin').emit('dispute:opened', {
    orderId: payload.orderId,
    listingId: payload.listingId
  });
}
```

This event only flows to `admin` — the buyer/seller already learn of the dispute via `order:updated` (status flip to `DISPUTED`) plus the `notification.created` event for the inbox/push.

- [ ] **Step 3: Add test**

```js
test('RealtimeGateway forwards dispute.created to admin room as dispute:opened', () => {
  const { emissions, server } = makeServer();
  const gateway = new RealtimeGateway(
    { getSessionUser: async () => null },
    { resolveIdentity: async () => null }
  );
  gateway.server = server;

  gateway.handleDisputeCreated({
    orderId: 'o1', listingId: 'l1', buyerId: 'b1', sellerId: 's1', raisedByUserId: 'b1'
  });

  assert.deepEqual(emissions, [{
    scope: 'admin',
    event: 'dispute:opened',
    data: { orderId: 'o1', listingId: 'l1' }
  }]);
});
```

- [ ] **Step 4: Run tests + commit**

```bash
yarn workspace vouchrex-api test
git add apps/api/src/modules/orders/orders.service.ts \
        apps/api/src/modules/realtime/realtime.gateway.ts \
        apps/api/test/realtime.gateway.test.cjs
git commit -m "feat(realtime): emit dispute:opened to admin room"
```

---

## Task 4: Admin — install dependencies

**Files:**
- Modify: `apps/admin/package.json`

- [ ] **Step 1: Install**

```bash
yarn workspace vouchrex-admin add socket.io-client sonner
```

- [ ] **Step 2: Typecheck**

```bash
yarn workspace vouchrex-admin typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/package.json yarn.lock
git commit -m "chore(admin): add socket.io-client and sonner toast"
```

---

## Task 5: Admin — server-only token helper + `RealtimeBridge` client

**Files:**
- Create: `apps/admin/lib/admin-token.ts`
- Create: `apps/admin/components/realtime-bridge.tsx`
- Create: `apps/admin/components/toast-host.tsx`

- [ ] **Step 1: Create `lib/admin-token.ts`**

```ts
import { cookies } from 'next/headers';
import { AUTH_CONFIG } from './constants';

/**
 * Server-only helper. Reads the admin session token from the httpOnly cookie.
 * Returns null when not signed in. Pass the result as a prop to the
 * RealtimeBridge client component so it can authenticate the socket.
 *
 * Exposing the token to the client via a server-rendered prop is intentional:
 * the admin app already proxies the same token via fetch() server-side, and
 * there is no separate "socket auth token" issuance path in Phase 1C.
 */
export async function getAdminTokenForClient(): Promise<string | null> {
  const store = await cookies();
  return store.get(AUTH_CONFIG.COOKIE_NAME)?.value ?? null;
}
```

- [ ] **Step 2: Create `components/toast-host.tsx`**

```tsx
'use client';

import { Toaster } from 'sonner';

export function ToastHost() {
  return <Toaster richColors closeButton position="top-right" />;
}
```

- [ ] **Step 3: Create `components/realtime-bridge.tsx`**

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import { toast } from 'sonner';

import { API_CONFIG } from '@/lib/constants';

type Props = {
  readonly token: string | null;
};

const TAB_FLASH_PREFIX = '🔔 ';

export function RealtimeBridge({ token }: Props) {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const originalTitleRef = useRef<string>('');
  const flashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) return;

    originalTitleRef.current = document.title;

    const wsUrl = API_CONFIG.BASE_URL.replace(/^http/, 'ws');
    const socket = io(wsUrl, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000
    });
    socketRef.current = socket;

    const refresh = () => { router.refresh(); };

    socket.on('order:updated', refresh);

    socket.on('dispute:opened', (payload: { orderId: string }) => {
      refresh();
      toast.warning('New dispute opened', {
        description: `Order ${payload.orderId.slice(0, 8)}…`,
        action: {
          label: 'Open',
          onClick: () => { window.location.href = `/disputes`; }
        }
      });
      startTabFlash();
    });

    const onFocus = () => { stopTabFlash(); };
    window.addEventListener('focus', onFocus);

    return () => {
      socket.disconnect();
      socketRef.current = null;
      window.removeEventListener('focus', onFocus);
      stopTabFlash();
    };

    function startTabFlash() {
      if (document.hasFocus()) return;
      if (flashIntervalRef.current) return;
      let flipped = false;
      flashIntervalRef.current = setInterval(() => {
        flipped = !flipped;
        document.title = flipped
          ? `${TAB_FLASH_PREFIX}${originalTitleRef.current}`
          : originalTitleRef.current;
      }, 1000);
    }

    function stopTabFlash() {
      if (flashIntervalRef.current) {
        clearInterval(flashIntervalRef.current);
        flashIntervalRef.current = null;
      }
      document.title = originalTitleRef.current;
    }
  }, [token, router]);

  return null;
}
```

- [ ] **Step 4: Typecheck**

```bash
yarn workspace vouchrex-admin typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin/lib/admin-token.ts apps/admin/components/realtime-bridge.tsx apps/admin/components/toast-host.tsx
git commit -m "feat(admin): add RealtimeBridge client + toast host + admin token helper"
```

---

## Task 6: Admin — mount in root layout

**Files:**
- Modify: `apps/admin/app/layout.tsx`

- [ ] **Step 1: Read the current layout**

Read `apps/admin/app/layout.tsx`. Identify where the `<body>` content is rendered and where children are slotted.

- [ ] **Step 2: Mount `RealtimeBridge` and `ToastHost`**

The layout is a server component. Read the admin token there and pass it as a prop:

```tsx
import { getAdminTokenForClient } from '@/lib/admin-token';
import { RealtimeBridge } from '@/components/realtime-bridge';
import { ToastHost } from '@/components/toast-host';

// Inside RootLayout, AFTER `await getAdminMe()` (or wherever auth is checked),
// or inside a layout that's already async:

const realtimeToken = await getAdminTokenForClient();

// In the JSX, immediately under <body> (or whatever the outermost wrapper is):
<RealtimeBridge token={realtimeToken} />
<ToastHost />
{children}
```

If the existing root layout is NOT async (Next.js 16 layouts can be), make it async. If `cookies()` causes the entire layout to be dynamic and there's a downstream cost, that's acceptable — every admin page is already user-specific.

If the login page exists at `/login` and uses a separate layout (no auth), `RealtimeBridge` should not mount there. Check the layout structure: if there's an `(authenticated)` route group or similar, mount the bridge in that group's layout instead of the root.

- [ ] **Step 3: Run typecheck and dev build**

```bash
yarn workspace vouchrex-admin typecheck
yarn workspace vouchrex-admin build
```

If the build fails because of static generation incompatibility (cookies() forces dynamic), accept the dynamic rendering — the admin app is not statically generated.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/app/layout.tsx
git commit -m "feat(admin): mount RealtimeBridge and ToastHost in root layout"
```

---

## Task 7: Smoke verification

- [ ] **Step 1: API tests + typecheck + lint**

```bash
yarn workspace vouchrex-api test
yarn workspace vouchrex-api typecheck
yarn workspace vouchrex-mobile typecheck
yarn workspace vouchrex-admin typecheck
yarn lint
```

All must pass; lint should only show pre-existing msg91 warnings.

- [ ] **Step 2: Boot and confirm**

```bash
make infra-up
yarn workspace vouchrex-api dev &
sleep 8
yarn workspace vouchrex-admin dev &
sleep 8

# Check the admin app boots
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3011/login
# Expected: 200 (or a redirect, anything non-5xx)

pkill -f "vouchrex-api dev" || true
pkill -f "vouchrex-admin dev" || true
```

- [ ] **Step 3: No commit needed for verification.**

---

## Spec coverage check

| Spec requirement (Phase 1C) | Implemented in |
|---|---|
| Gateway accepts admin token, joins `admin` room | Task 1 |
| `order:updated` broadcast to `admin` | Task 2 |
| `dispute:opened` event for tab flash | Task 3 |
| `socket.io-client` + toast lib in admin | Task 4 |
| `RealtimeBridge` client component | Task 5 |
| Tab title flash on `dispute:opened` | Task 5 (in `RealtimeBridge`) |
| `router.refresh()` to reload server-component data | Task 5 |
| Toast on `dispute:opened` | Task 5 (sonner `toast.warning`) |
| Mounted at root layout, token sourced from cookie | Task 6 |
| Smoke verification | Task 7 |
