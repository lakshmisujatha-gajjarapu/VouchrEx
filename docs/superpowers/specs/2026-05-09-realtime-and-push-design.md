# Realtime + Push Notifications — Design

**Date:** 2026-05-09
**Status:** Draft for review
**Owner:** mobile + api

## Problem

The app does not feel real-time. When a buyer purchases a voucher, the seller has no immediate signal — they must reopen the app and pull-to-refresh. The same applies to order status changes (payment confirmed, code revealed, dispute opened, auto-confirm) and to the Bazaar feed when listings are sold or posted.

The infrastructure for in-app realtime already exists (`RealtimeGateway` Socket.IO server + `SocketProvider` client) but is not wired into screens. There is no push notification delivery, so anything happening while the app is closed is invisible to the user.

## Goals

1. **In-app realtime** — when the app is open, lists and detail screens update without manual refresh.
2. **Push notifications** — when the app is backgrounded or closed, the user gets an OS-level notification for money-or-action events. Tapping deep-links to the relevant screen.
3. **No Live Activities, no Dynamic Island, no per-channel preferences UI** — explicitly out of scope for Phase 1.

## Non-goals (Phase 1)

- iOS Live Activities / Dynamic Island
- Android `Notification.ProgressStyle` live notifications
- Per-channel notification preferences UI ("mute marketing", "mute disputes", etc.)
- Quiet hours
- Push receipt polling (Expo ticket-only for Phase 1)
- Web Push delivery (admin app) — `PushToken.platform = WEB` is reserved in the schema for Phase 2; no registration, no send path implemented in Phase 1
- Direct APNs/FCM integration (Expo Push handles forwarding for Phase 1)
- Patch-in-place Bazaar list updates (full reload on event for now)
- Chat / DM realtime (chat module does not exist yet)

## Existing infrastructure (do not rebuild)

- **Server:** `apps/api/src/modules/realtime/realtime.gateway.ts` — Socket.IO gateway, joins each authenticated socket to a `user:{userId}` room. Already handles `notification.created` and `order.updated` events from `EventEmitter2`.
- **Mobile:** `apps/mobile/src/hooks/use-socket.tsx` — `SocketProvider` connects on sign-in with the session token, auto-reconnects, exposes `socket` + `connected`.
- **Mobile thin hooks:** `useOrderSocket(orderId, cb)`, `useNotificationsSocket(cb)` — already exist and follow the dumb event-to-callback pattern.
- **Mobile data hook:** `useAsyncResource<T>(load)` — every screen already uses this; exposes `reload()`. Cache invalidation = call `reload()`.

## Design

### Server-emitted event catalogue

| Event | Emitted when | Audience | Used for |
|---|---|---|---|
| `order:updated` *(exists)* | order status transitions in `orders.service.ts` | buyer + seller (per-user rooms) | Orders list/detail refresh + push trigger |
| `notification:new` *(exists)* | `NotificationsService.create()` | recipient (per-user room) | Inbox refresh + tab badge + push trigger |
| `listing:created` *(new)* | `ListingsService.create()` | broadcast | Bazaar feed insert |
| `listing:updated` *(new)* | listing status flips (`AVAILABLE` ↔ `RESERVED` ↔ `SOLD`) | broadcast | Bazaar feed update/remove, listing detail status |

**Routing rule for `listing:*`:** always silent. Personal events (you bought it, you sold it) flow through `order:updated` and `notification:new`, which trigger pushes. `listing:*` is a feed-sync event only — never a push, never a toast.

### Mobile — new socket hooks

| Hook | Subscribes to | Used by |
|---|---|---|
| `useOrderSocket(orderId, cb)` *(exists)* | `order:updated` for one order | order detail |
| `useOrdersListSocket(cb)` *(new)* | `order:updated` (any) | Orders tab list |
| `useNotificationsSocket(cb)` *(exists)* | `notification:new` | Inbox + app-level provider |
| `useListingsSocket({ onCreated, onUpdated })` *(new)* | `listing:created`, `listing:updated` | Bazaar, Sell, listing detail |

All hooks are thin event-to-callback bridges. Screens own their data via `useAsyncResource` and call `reload()` from the callback.

### Mobile — app-level pieces

1. **`NotificationCenterProvider`** — wraps the app at root. Subscribes once to `notification:new`. Owns:
   - unread count → drives Inbox tab badge
   - in-app toast (via `react-native-toast-message`) when a notification arrives in foreground
   - tap-to-deep-link via the notification's `link` field
2. **`PushTokenRegistrar`** — runs on sign-in:
   - requests notification permission via `expo-notifications`
   - obtains Expo push token
   - POSTs to `/me/push-tokens` (idempotent on `{userId, deviceId}`)
   - re-registers on token rotation
   - on sign-out: `DELETE /me/push-tokens/:deviceId`
3. **Tap handler** — single Expo Router push handler used by both the in-app toast and the OS notification tap. Reads `data.link`, navigates.

### Mobile — per-screen wiring

| Screen | Change |
|---|---|
| `(tabs)/index` (Bazaar) | `useListingsSocket` → `reload()` on any event |
| `(tabs)/sell` | `useListingsSocket` filtered to `sellerId === me` → `reload()` |
| `(tabs)/orders` | `useOrdersListSocket` → `reload()` |
| `orders/[id]` | already wired via `useOrderSocket` |
| `(tabs)/inbox` | uses `NotificationCenterProvider`'s state; prepends new entries |
| `listings/[id]` | `useListingsSocket` filtered to `listingId === id` |

### Reconnect & catch-up

When the socket reconnects after a drop (or the app foregrounds), in-flight events are missed. Mitigation: the existing `useRefetchOnFocus` is extended to also fire on socket reconnect, triggering `reload()` on visible screens. Cheap, eliminates stale UI after returning from background.

### Push notifications — server side

#### New Prisma model

```prisma
model PushToken {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  deviceId   String   // stable per-install id (expo-application getInstallationIdAsync)
  token      String   // ExponentPushToken[xxx]
  platform   Platform // IOS | ANDROID
  createdAt  DateTime @default(now())
  lastSeenAt DateTime @updatedAt

  @@unique([userId, deviceId])
  @@index([userId])
}

enum Platform {
  IOS
  ANDROID
  WEB
}
```

#### New endpoints

| Method | Path | Auth | Body |
|---|---|---|---|
| `POST` | `/me/push-tokens` | `x-session-token` | `{ deviceId, token, platform }` — upserts on `(userId, deviceId)` |
| `DELETE` | `/me/push-tokens/:deviceId` | `x-session-token` | — |

#### New module — `apps/api/src/modules/push/`

```
push/
  push.module.ts
  push.service.ts        // sendToUser(userId, payload), sendToUsers([...], payload)
  push.controller.ts     // the two endpoints above
  push.dispatcher.ts     // @OnEvent listeners; consults event→push mapping
  push.events.ts         // mapping table: eventType → { title, body, link, audience, pushEnabled }
  expo-push.client.ts    // wraps expo-server-sdk; chunks at 100, handles DeviceNotRegistered
```

`PushService.sendToUser(userId, payload)`:

1. Load all `PushToken` rows for the user
2. Compute dedupe key: `push:{userId}:{eventType}:{entityId}`
3. Redis `SET NX EX 60` — bail if key exists (already sent recently)
4. Skip if recipient is currently in their `user:{userId}` socket room (foreground suppression)
5. Skip if `payload.actorUserId === userId` (actor suppression)
6. Build Expo messages, chunk, send via `expo-server-sdk`
7. On `DeviceNotRegistered` ticket → delete that `PushToken` row
8. Log structured line: `{eventType, recipientId, dedupeKey, ticketId | skippedReason}`

#### Dispatcher — single source of truth for the §2 matrix

`PushDispatcher` listens to existing `EventEmitter2` events alongside `RealtimeGateway`:

```ts
@OnEvent('notification.created') handleNotification(payload) { ... }
@OnEvent('order.updated')        handleOrderUpdated(payload) { ... }
```

Each handler consults `push.events.ts` — a table mapping event types to push payloads. If `pushEnabled: false`, no push is sent (in-app realtime still flows via the gateway). All push policy lives in this one file.

#### Push payload contract

Every push message MUST include:

```ts
{
  to: pushToken,
  title: string,
  body: string,
  data: {
    link: string,        // deep-link path, e.g. "/orders/abc123"
    eventType: string,   // for analytics / debugging
    entityId: string     // orderId, listingId, etc.
  },
  sound: 'default',
  priority: 'high'
}
```

`data.link` is required. The mobile tap handler reads only this field to route.

#### Push vs in-app matrix (Phase 1)

**Buyer side**

| Event | Push | In-app |
|---|---|---|
| Payment confirmed, escrow active | ✅ | ✅ |
| Code revealed / ready to use | ✅ | ✅ |
| Auto-confirm in 1 hour (warning) | ✅ | ✅ |
| Order auto-confirmed | ✅ | ✅ |
| Dispute resolved | ✅ | ✅ |

**Seller side**

| Event | Push | In-app |
|---|---|---|
| Voucher sold | ✅ | ✅ |
| Buyer revealed the code | ✅ | ✅ |
| Order auto-confirmed (payout incoming) | ✅ | ✅ |
| Dispute opened | ✅ | ✅ |
| Payout completed | ✅ | ✅ |
| Listing expired without selling | ❌ | ✅ |

**Bazaar / browsing**

| Event | Push | In-app |
|---|---|---|
| `listing:created` | ❌ | ✅ |
| `listing:updated` | ❌ | ✅ |

### Environment

- `EXPO_ACCESS_TOKEN` — server-side, recommended. Prevents anyone with a leaked Expo push token from sending pushes to our users.
- `REDIS_URL` — already configured for the existing infra.
- No APNs/FCM keys required for Phase 1.

## Phasing

### Phase 1A — In-app realtime (1–2 days)

- Emit `listing:created` / `listing:updated` from `ListingsService` via `EventEmitter2`
- Add `@OnEvent('listing.created')` and `@OnEvent('listing.updated')` handlers in `RealtimeGateway` that broadcast (no room filter)
- Implement `useListingsSocket` and `useOrdersListSocket`
- Wire Bazaar, Sell, Orders, listing detail to call `reload()` on events
- Install `react-native-toast-message`; render `<Toast />` once at app root
- Implement `NotificationCenterProvider` (toast + unread badge)

**Done state:** with the app open, the UI updates live for all events in the catalogue.

### Phase 1B — Push notifications (2–3 days)

- Add `expo-notifications` and `expo-application` to mobile
- Prisma migration for `PushToken` model
- Implement `push/` module + endpoints
- Implement `PushTokenRegistrar` on mobile (register on sign-in, delete on sign-out)
- Implement `PushDispatcher` with the mapping table covering every event in the matrix
- Implement Redis dedup, actor suppression, foreground suppression
- Implement tap-to-deep-link handler reading `data.link`
- Wire `EXPO_ACCESS_TOKEN` env var

**Done state:** sellers receive "voucher sold" pushes with the app closed. Tapping deep-links to the order. Buyers receive payment/reveal/dispute pushes.

### Phase 1C — Admin app realtime (0.5–1 day)

The admin Next.js app (`apps/admin/`) has operational queues (orders, disputes, payouts, refunds) where staff need to see new events without manual refresh. Push notifications are out of scope (desktop web app, no Web Push for Phase 1).

#### Gateway change

`RealtimeGateway.handleConnection` already authenticates via `AuthService.getSessionUser(token)`. Extend it to also accept the admin API token:

1. Try session token → if valid, join `user:{userId}` (existing behaviour)
2. Else try admin token (compare against `ADMIN_API_TOKEN`) → if valid, join `admin` room
3. Else disconnect

A single socket joins exactly one of those rooms. No mixing.

#### New events emitted to the `admin` room

| Event | Source | Audience |
|---|---|---|
| `order:updated` *(existing event, additional broadcast)* | `OrdersService` | per-user rooms **and** `admin` |
| `dispute:opened` *(new)* | `DisputesService` (when service exists; emit on creation) | `admin` |
| `dispute:updated` *(new)* | `DisputesService` | `admin` + buyer + seller |
| `payout:updated` *(new)* | `PayoutsService` | `admin` + seller |

User-feed events (`listing:created`, `listing:updated`, `notification:new`) do **not** go to `admin` — too noisy.

#### Admin client

- Add `socket.io-client` to `apps/admin/package.json`
- New `lib/socket.ts` — singleton client, connects with `auth: { token: ADMIN_TOKEN }` (token already on the admin app — same one used for HTTP requests)
- New `hooks/use-admin-socket.ts` — thin event-to-callback bridge, mirrors mobile pattern
- Per-view wiring:
  - `app/orders/` → reload on `order:updated`
  - `app/disputes/` → reload on `dispute:opened` / `dispute:updated`; flash unread badge in nav
  - `app/payouts/` → reload on `payout:updated`
  - `app/dashboard/` → reload on any of the above
- **Tab title flash** — when a high-priority event (`dispute:opened`) arrives and the tab is not focused, prefix the document title with `(N) ` until the tab is focused again
- **In-app toast** — same library family as mobile (`react-hot-toast` or equivalent for Next.js); skip if already implemented in admin

#### Out of scope for admin (Phase 1)

- Web Push (requires VAPID key setup, low value when staff have dashboard open during shifts)
- Per-admin filtering (all admins see all events; fine at current team size)

### Phase 1D — Hardening (0.5–1 day)

- Wire socket reconnect → `reload()` on visible screens (extend `useRefetchOnFocus`)
- Real-device QA matrix: foreground / background / killed × iOS / Android × permission granted/denied
- Structured logging on every push send (eventType, recipientId, dedupeKey, ticketId, skipped-reason)

**Done state:** edge cases handled, push activity is fully observable in logs.

## Testing

### Server (`*.test.cjs`)

- `PushDispatcher` mapping — for each event in `push.events.ts`, asserts the expected `(title, body, link, audience, pushEnabled)`
- `PushService.sendToUser`
  - dedupe: second call within 60s for same key is skipped
  - actor suppression: skipped when `actorUserId === recipientId`
  - foreground suppression: skipped when recipient is in their socket room
  - DeviceNotRegistered → token row is deleted
- `RealtimeGateway` — `listing.created` / `listing.updated` handlers broadcast to all sockets

### Mobile

- Manual real-device QA for Phase 1B (Expo Push doesn't work in iOS simulator)
- Permission denied path: app must function normally; no crashes on `getExpoPushTokenAsync` failure

## Considered alternatives

### Server-Sent Events (SSE) instead of Socket.IO

SSE is a simpler protocol — pure HTTP, no WebSocket handshake, native `EventSource` in browsers. We chose to keep Socket.IO for these reasons:

- **It's already implemented and working** in `RealtimeGateway`, `SocketProvider`, `useOrderSocket`, `useNotificationsSocket`. Switching means rewriting all four files for no end-user-visible benefit.
- **Per-user routing is fundamental to this design** (the `user:{id}` room is how every personal event is delivered). SSE has no rooms primitive — we would reimplement `Map<userId, Set<Response>>` with manual `res.write()` and connection cleanup, effectively rebuilding the smallest useful subset of Socket.IO without its battle-tested reconnect logic.
- **React Native has no native `EventSource`.** Going SSE means adding `react-native-sse` (its own quirks around auth headers and reconnect) — equal or larger surface area than the already-installed `socket.io-client`.
- **Future optionality.** Chat, typing indicators, presence are all bidirectional. Socket.IO supports them on the same connection; SSE forces a separate HTTP POST channel.

SSE would be the right call for a greenfield project with broadcast-only events and no per-user routing. That is not this project.

## Risks & open questions

- **Broadcast scale.** `listing:*` is broadcast to every connected socket. Fine at current scale (hundreds of users); revisit if active connections cross ~10k. Mitigation path: per-region rooms or selective subscription.
- **Push permission denial rate.** If a meaningful fraction of users deny notifications, sellers will still feel the app is unresponsive when closed. Phase 2 may need a permission re-prompt UX after the first sale.
- **EXPO_ACCESS_TOKEN must be set in prod before Phase 1B ships** — without it, anyone holding a leaked Expo push token could send pushes appearing to come from us.
- **Sign-out must delete the push token row.** Otherwise on shared devices, the previous user gets the next user's pushes.

## Future phases (informational)

- **Phase 2:** push receipt polling (in the existing worker placeholder), per-channel preferences UI, Live Activities for the escrow countdown timer.
- **Phase 3+:** direct APNs/FCM if/when Expo Push limits become a problem; web push for the admin app; chat realtime once the chat module exists.
