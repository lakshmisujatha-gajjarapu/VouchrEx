# Realtime Phase 1B — Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send OS-level push notifications to mobile devices via Expo Push API for money-or-action events (voucher sold, code revealed, dispute opened, payment confirmed, etc.). Tapping deep-links to the relevant screen.

**Architecture:** A new server-side `push/` module listens to `notification.created` events (the same event the realtime gateway already consumes), looks up an event-type → push-payload mapping, and forwards to Expo Push API via `expo-server-sdk`. Mobile registers an Expo push token on sign-in via two new endpoints. Dedup is in-memory (single API instance), foreground suppression checks Socket.IO active rooms, actor suppression checks if recipient triggered the event.

**Tech Stack:** NestJS, Prisma, `expo-server-sdk` (server), `expo-notifications` + `expo-application` (mobile), Expo Push API.

**Reference spec:** `docs/superpowers/specs/2026-05-09-realtime-and-push-design.md` (Phase 1B section)

**Reference plan:** Phase 1A in `docs/superpowers/plans/2026-05-09-realtime-phase-1a-in-app.md` (already completed)

## File map

| File | Action | Responsibility |
|---|---|---|
| `apps/api/prisma/schema.prisma` | modify | add `PushToken` model + `Platform` enum |
| `apps/api/prisma/migrations/<ts>_add_push_tokens/migration.sql` | create | DB migration |
| `apps/api/package.json` | modify | add `expo-server-sdk` |
| `apps/api/src/modules/push/push.module.ts` | create | Nest module |
| `apps/api/src/modules/push/push.service.ts` | create | sendToUser, dedup, suppression, token cleanup |
| `apps/api/src/modules/push/push.controller.ts` | create | POST/DELETE endpoints |
| `apps/api/src/modules/push/push.dispatcher.ts` | create | @OnEvent('notification.created') |
| `apps/api/src/modules/push/push.events.ts` | create | event-type → push payload mapping |
| `apps/api/src/modules/push/expo-push.client.ts` | create | wraps expo-server-sdk |
| `apps/api/src/modules/push/dto/register-push-token.dto.ts` | create | DTO |
| `apps/api/src/modules/realtime/realtime.gateway.ts` | modify | add `isUserConnected(userId)` helper for suppression |
| `apps/api/src/app.module.ts` | modify | register `PushModule` |
| `apps/api/src/main.ts` | modify | add `EXPO_ACCESS_TOKEN` to env schema (optional) |
| `apps/api/test/push.dispatcher.test.cjs` | create | mapping tests + suppression tests |
| `apps/api/test/push.service.test.cjs` | create | dedup + cleanup tests |
| `apps/mobile/package.json` | modify | add `expo-notifications`, `expo-application` |
| `apps/mobile/app.config.ts` (or `app.json`) | modify | configure expo-notifications plugin |
| `apps/mobile/src/lib/push.ts` | create | register/unregister logic + tap listener setup |
| `apps/mobile/src/hooks/use-push-registrar.tsx` | create | mounts on sign-in, registers token; deletes on sign-out |
| `apps/mobile/src/app/_layout.tsx` | modify | mount `PushRegistrar` inside SocketProvider |
| `apps/mobile/src/lib/api.ts` | modify | add `registerPushToken` and `unregisterPushToken` API helpers |

## Out of scope (Phase 1C/1D)

- Per-channel notification preferences UI
- Push receipt polling (in worker app, Phase 2)
- Direct APNs/FCM keys (Expo Push handles for Phase 1)
- Web push registration (`Platform.WEB` reserved in enum, no registration path)
- Quiet hours

---

## Task 1: Prisma migration for `PushToken`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_push_tokens/migration.sql` (via `prisma migrate dev`)

- [ ] **Step 1: Edit `schema.prisma`**

In `apps/api/prisma/schema.prisma`, add after the existing `Notification` model (or near other user-related models):

```prisma
enum Platform {
  IOS
  ANDROID
  WEB
}

model PushToken {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  deviceId   String
  token      String
  platform   Platform
  createdAt  DateTime @default(now())
  lastSeenAt DateTime @updatedAt

  @@unique([userId, deviceId])
  @@index([userId])
}
```

In the `User` model, add the inverse relation:

```prisma
pushTokens PushToken[]
```

(Place it next to other relation fields on `User`.)

- [ ] **Step 2: Generate the migration**

```bash
yarn workspace vouchrex-api prisma:migrate:dev --name add_push_tokens
```

This produces both the migration SQL and runs it locally.

- [ ] **Step 3: Verify the migration file**

Read the generated `apps/api/prisma/migrations/<timestamp>_add_push_tokens/migration.sql`. Confirm it creates:
- The `Platform` enum
- The `PushToken` table with unique `(userId, deviceId)` constraint
- The FK to `User`

- [ ] **Step 4: Run typecheck (Prisma client regenerated)**

```bash
yarn workspace vouchrex-api typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(push): add PushToken model and Platform enum"
```

---

## Task 2: Add `expo-server-sdk` to API

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Install**

```bash
yarn workspace vouchrex-api add expo-server-sdk
```

- [ ] **Step 2: Add `EXPO_ACCESS_TOKEN` to env schema (optional)**

In `apps/api/src/main.ts`, find the env Zod schema (line ~14). Add an optional entry:

```ts
EXPO_ACCESS_TOKEN: z.string().optional(),
```

This is optional in dev. In production it should be set; we warn-on-missing later.

- [ ] **Step 3: Typecheck and lint**

```bash
yarn workspace vouchrex-api typecheck && yarn workspace vouchrex-api lint
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/package.json yarn.lock apps/api/src/main.ts
git commit -m "chore(push): add expo-server-sdk and EXPO_ACCESS_TOKEN env var"
```

---

## Task 3: Build `ExpoPushClient`

**Files:**
- Create: `apps/api/src/modules/push/expo-push.client.ts`

- [ ] **Step 1: Create the file**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';

@Injectable()
export class ExpoPushClient {
  private readonly logger = new Logger(ExpoPushClient.name);
  private readonly expo: Expo;

  constructor() {
    const accessToken = process.env.EXPO_ACCESS_TOKEN;
    if (!accessToken && process.env.NODE_ENV === 'production') {
      this.logger.warn('EXPO_ACCESS_TOKEN is not set in production — pushes are spoofable');
    }
    this.expo = new Expo({ accessToken });
  }

  /**
   * Returns true if the supplied string is a valid Expo push token.
   */
  isValidToken(token: string): boolean {
    return Expo.isExpoPushToken(token);
  }

  /**
   * Sends a batch of messages and returns the ticket array.
   * Caller is responsible for checking `ticket.status === 'error'` and reacting.
   */
  async sendChunked(messages: readonly ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    const chunks = this.expo.chunkPushNotifications(messages as ExpoPushMessage[]);
    const tickets: ExpoPushTicket[] = [];
    for (const chunk of chunks) {
      try {
        const chunkTickets = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...chunkTickets);
      } catch (error) {
        this.logger.error('Expo push send failed', error);
      }
    }
    return tickets;
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
yarn workspace vouchrex-api typecheck
```

- [ ] **Step 3: Commit (combined with Task 4 below)**

Hold the commit until Task 4 — Service uses Client, easier to commit together.

---

## Task 4: Build `PushService`

**Files:**
- Create: `apps/api/src/modules/push/push.service.ts`
- Create: `apps/api/test/push.service.test.cjs`

- [ ] **Step 1: Create the service**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { type ExpoPushMessage } from 'expo-server-sdk';

import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ExpoPushClient } from './expo-push.client';

const DEDUP_TTL_MS = 60_000;

export type SendPushPayload = {
  readonly title: string;
  readonly body: string;
  readonly link: string;
  readonly eventType: string;
  readonly entityId: string;
  readonly dedupeKey: string;
  readonly actorUserId?: string;
};

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly dedupCache = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly expoClient: ExpoPushClient,
    private readonly realtimeGateway: RealtimeGateway
  ) {}

  async sendToUser(userId: string, payload: SendPushPayload): Promise<void> {
    if (this.shouldSkipForActor(userId, payload)) return;
    if (this.shouldSkipForDedup(payload.dedupeKey)) return;
    if (await this.shouldSkipForForeground(userId)) {
      this.logger.debug(`Skip push (foreground): user=${userId} event=${payload.eventType}`);
      return;
    }

    const tokens = await this.prisma.pushToken.findMany({ where: { userId } });
    if (tokens.length === 0) return;

    const messages: ExpoPushMessage[] = tokens
      .filter((t) => this.expoClient.isValidToken(t.token))
      .map((t) => ({
        to: t.token,
        title: payload.title,
        body: payload.body,
        sound: 'default',
        priority: 'high',
        data: {
          link: payload.link,
          eventType: payload.eventType,
          entityId: payload.entityId
        }
      }));

    if (messages.length === 0) return;

    const tickets = await this.expoClient.sendChunked(messages);

    await this.cleanupDeadTokens(tickets, tokens);

    this.logger.log(
      `Push sent: user=${userId} event=${payload.eventType} tokens=${tokens.length} tickets=${tickets.length}`
    );
  }

  private shouldSkipForActor(userId: string, payload: SendPushPayload): boolean {
    return payload.actorUserId === userId;
  }

  private shouldSkipForDedup(dedupeKey: string): boolean {
    const now = Date.now();
    this.purgeExpiredDedupEntries(now);
    if (this.dedupCache.has(dedupeKey)) return true;
    this.dedupCache.set(dedupeKey, now + DEDUP_TTL_MS);
    return false;
  }

  private purgeExpiredDedupEntries(now: number): void {
    for (const [key, expiresAt] of this.dedupCache) {
      if (expiresAt <= now) this.dedupCache.delete(key);
    }
  }

  private async shouldSkipForForeground(userId: string): Promise<boolean> {
    return this.realtimeGateway.isUserConnected(userId);
  }

  private async cleanupDeadTokens(
    tickets: readonly { status?: string; details?: { error?: string } }[],
    tokens: readonly { id: string; token: string }[]
  ): Promise<void> {
    const deadTokenIds: string[] = [];
    tickets.forEach((ticket, i) => {
      const error = ticket.details?.error;
      if (ticket.status === 'error' && (error === 'DeviceNotRegistered' || error === 'InvalidCredentials')) {
        deadTokenIds.push(tokens[i]!.id);
      }
    });
    if (deadTokenIds.length > 0) {
      await this.prisma.pushToken.deleteMany({ where: { id: { in: deadTokenIds } } });
      this.logger.log(`Cleaned up ${deadTokenIds.length} dead push tokens`);
    }
  }

  /**
   * Test-only helper: clears the in-memory dedup cache so tests are isolated.
   */
  __clearDedupForTests(): void {
    this.dedupCache.clear();
  }
}
```

- [ ] **Step 2: Write the test**

Create `apps/api/test/push.service.test.cjs`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

require('ts-node/register/transpile-only');

const { PushService } = require('../src/modules/push/push.service.ts');

function makeService({ pushTokens = [], realtimeConnected = false, sendResult = [] } = {}) {
  const sentBatches = [];
  const deletedIds = [];
  const prisma = {
    pushToken: {
      findMany: async () => pushTokens,
      deleteMany: async ({ where }) => { deletedIds.push(...where.id.in); return { count: where.id.in.length }; }
    }
  };
  const expoClient = {
    isValidToken: () => true,
    sendChunked: async (messages) => { sentBatches.push(messages); return sendResult; }
  };
  const realtimeGateway = { isUserConnected: async () => realtimeConnected };
  const service = new PushService(prisma, expoClient, realtimeGateway);
  return { service, sentBatches, deletedIds };
}

test('PushService skips push when actor and recipient are the same user', async () => {
  const { service, sentBatches } = makeService({
    pushTokens: [{ id: 't1', token: 'ExponentPushToken[abc]' }]
  });

  await service.sendToUser('u1', {
    title: 'X', body: 'Y', link: '/x', eventType: 'order.confirmed',
    entityId: 'o1', dedupeKey: 'k1', actorUserId: 'u1'
  });

  assert.equal(sentBatches.length, 0);
});

test('PushService skips push when recipient has active socket connection', async () => {
  const { service, sentBatches } = makeService({
    pushTokens: [{ id: 't1', token: 'ExponentPushToken[abc]' }],
    realtimeConnected: true
  });

  await service.sendToUser('u1', {
    title: 'X', body: 'Y', link: '/x', eventType: 'order.confirmed',
    entityId: 'o1', dedupeKey: 'k2'
  });

  assert.equal(sentBatches.length, 0);
});

test('PushService dedups identical sends within window', async () => {
  const { service, sentBatches } = makeService({
    pushTokens: [{ id: 't1', token: 'ExponentPushToken[abc]' }]
  });

  const payload = {
    title: 'X', body: 'Y', link: '/x', eventType: 'order.confirmed',
    entityId: 'o1', dedupeKey: 'k3'
  };
  await service.sendToUser('u1', payload);
  await service.sendToUser('u1', payload);

  assert.equal(sentBatches.length, 1);
});

test('PushService deletes tokens flagged DeviceNotRegistered', async () => {
  const { service, deletedIds } = makeService({
    pushTokens: [
      { id: 't1', token: 'ExponentPushToken[a]' },
      { id: 't2', token: 'ExponentPushToken[b]' }
    ],
    sendResult: [
      { status: 'ok' },
      { status: 'error', details: { error: 'DeviceNotRegistered' } }
    ]
  });

  await service.sendToUser('u1', {
    title: 'X', body: 'Y', link: '/x', eventType: 'order.confirmed',
    entityId: 'o1', dedupeKey: 'k4'
  });

  assert.deepEqual(deletedIds, ['t2']);
});
```

- [ ] **Step 3: Run tests**

```bash
yarn workspace vouchrex-api test --test-name-pattern="PushService"
```

(Expect a failure first because `realtimeGateway.isUserConnected` doesn't exist yet — Task 5 adds it. If failures occur due to that, move on to Task 5 and retest at the end.)

Add to your TodoWrite that this test will be retried after Task 5.

- [ ] **Step 4: Commit (after Task 5)**

Hold commit until Task 5 — service depends on the gateway helper.

---

## Task 5: Add `isUserConnected` helper to `RealtimeGateway`

**Files:**
- Modify: `apps/api/src/modules/realtime/realtime.gateway.ts`
- Test: `apps/api/test/realtime.gateway.test.cjs` (extend)

- [ ] **Step 1: Add the helper**

In `apps/api/src/modules/realtime/realtime.gateway.ts`, add a public method:

```ts
async isUserConnected(userId: string): Promise<boolean> {
  const sockets = await this.server.in(`user:${userId}`).fetchSockets();
  return sockets.length > 0;
}
```

- [ ] **Step 2: Add the test**

Append to `apps/api/test/realtime.gateway.test.cjs`:

```js
test('RealtimeGateway.isUserConnected returns true when sockets exist in user room', async () => {
  const gateway = new RealtimeGateway({ getSessionUser: async () => null });
  gateway.server = {
    in: (room) => ({
      fetchSockets: async () => (room === 'user:u1' ? [{}, {}] : [])
    })
  };

  assert.equal(await gateway.isUserConnected('u1'), true);
  assert.equal(await gateway.isUserConnected('u2'), false);
});
```

- [ ] **Step 3: Run tests**

```bash
yarn workspace vouchrex-api test --test-name-pattern="isUserConnected|PushService"
```

All should pass.

- [ ] **Step 4: Combined commit for Tasks 3, 4, 5**

```bash
git add apps/api/src/modules/realtime/realtime.gateway.ts \
        apps/api/src/modules/push/expo-push.client.ts \
        apps/api/src/modules/push/push.service.ts \
        apps/api/test/realtime.gateway.test.cjs \
        apps/api/test/push.service.test.cjs
git commit -m "feat(push): add ExpoPushClient, PushService, and gateway connection helper"
```

---

## Task 6: Build `PushDispatcher` + event mapping

**Files:**
- Create: `apps/api/src/modules/push/push.events.ts`
- Create: `apps/api/src/modules/push/push.dispatcher.ts`
- Test: `apps/api/test/push.dispatcher.test.cjs`

- [ ] **Step 1: Create the event mapping**

`apps/api/src/modules/push/push.events.ts`:

```ts
export type PushEnabledEvent = {
  readonly title: (notification: NotificationLike) => string;
  readonly body: (notification: NotificationLike) => string;
  readonly link: (notification: NotificationLike) => string;
};

export type NotificationLike = {
  readonly id: string;
  readonly userId: string | null;
  readonly orderId: string | null;
  readonly listingId: string | null;
  readonly eventType: string;
  readonly title: string;
  readonly message: string;
  readonly metadata: unknown;
};

const orderLink = (n: NotificationLike) => (n.orderId ? `/orders/${n.orderId}` : '/inbox');
const listingLink = (n: NotificationLike) => (n.listingId ? `/listings/${n.listingId}` : '/inbox');

/**
 * Event-types whose `notification.created` should also trigger a push.
 * Title/body default to the notification's own title/message.
 * Anything not in this map = in-app only, no push.
 *
 * Spec reference: §2 Push vs in-app matrix.
 */
export const PUSH_ENABLED_EVENTS: Record<string, PushEnabledEvent> = {
  // Buyer
  'order.payment.confirmed': { title: (n) => n.title, body: (n) => n.message, link: orderLink },
  'order.code.revealed':     { title: (n) => n.title, body: (n) => n.message, link: orderLink },
  'order.autoconfirm.warning': { title: (n) => n.title, body: (n) => n.message, link: orderLink },
  'order.autoconfirmed':     { title: (n) => n.title, body: (n) => n.message, link: orderLink },
  'dispute.resolved':        { title: (n) => n.title, body: (n) => n.message, link: orderLink },

  // Seller
  'listing.sold':            { title: (n) => n.title, body: (n) => n.message, link: orderLink },
  'order.code.revealed.seller': { title: (n) => n.title, body: (n) => n.message, link: orderLink },
  'order.autoconfirmed.seller': { title: (n) => n.title, body: (n) => n.message, link: orderLink },
  'dispute.opened':          { title: (n) => n.title, body: (n) => n.message, link: orderLink },
  'payout.completed':        { title: (n) => n.title, body: (n) => n.message, link: '/profile' }
};

export function shouldPush(eventType: string): boolean {
  return eventType in PUSH_ENABLED_EVENTS;
}

export function buildPushPayload(notification: NotificationLike) {
  const config = PUSH_ENABLED_EVENTS[notification.eventType];
  if (!config) return null;
  return {
    title: config.title(notification),
    body: config.body(notification),
    link: config.link(notification)
  };
}
```

> NOTE: the event-type strings above (e.g. `order.payment.confirmed`) must match what `OrdersService` and `NotificationsService` actually pass as `eventType` when creating notifications. Before Task 7, audit existing notification creation calls and adjust either the mapping keys or the production code so they match. If existing code uses a string like `'voucher.sold'` instead of `'listing.sold'`, update the mapping key, not the production code.

- [ ] **Step 2: Audit existing event-type strings**

Run:
```bash
grep -rn "eventType:" apps/api/src/modules/orders/orders.service.ts \
                      apps/api/src/modules/listings/listings.service.ts \
                      apps/api/src/modules/payments/
```

Build a list of every `eventType` literal currently passed to `NotificationsService.createNotification`. Update the keys in `PUSH_ENABLED_EVENTS` to match exactly. The mapping is defined by what production already emits — do NOT rename production strings to fit a tidier map. If a desired push event has no current notification (e.g. there is no "auto-confirm warning" notification yet), drop it from the map for Phase 1B; we add it in a follow-up.

Document the final mapping in a comment at the top of `push.events.ts`.

- [ ] **Step 3: Create the dispatcher**

`apps/api/src/modules/push/push.dispatcher.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { type NotificationLike, buildPushPayload, shouldPush } from './push.events';
import { PushService } from './push.service';

type NotificationCreatedEvent = {
  readonly userId: string;
  readonly notification: NotificationLike;
  readonly actorUserId?: string;
};

@Injectable()
export class PushDispatcher {
  private readonly logger = new Logger(PushDispatcher.name);

  constructor(private readonly pushService: PushService) {}

  @OnEvent('notification.created')
  async handleNotificationCreated(payload: NotificationCreatedEvent): Promise<void> {
    const { notification, userId, actorUserId } = payload;
    if (!shouldPush(notification.eventType)) return;

    const built = buildPushPayload(notification);
    if (!built) return;

    await this.pushService.sendToUser(userId, {
      ...built,
      eventType: notification.eventType,
      entityId: notification.orderId ?? notification.listingId ?? notification.id,
      dedupeKey: `${userId}:${notification.eventType}:${notification.orderId ?? notification.listingId ?? notification.id}`,
      actorUserId
    });
  }
}
```

- [ ] **Step 4: Test the dispatcher**

`apps/api/test/push.dispatcher.test.cjs`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

require('ts-node/register/transpile-only');

const { PushDispatcher } = require('../src/modules/push/push.dispatcher.ts');
const { PUSH_ENABLED_EVENTS } = require('../src/modules/push/push.events.ts');

test('PushDispatcher does NOT push events not in PUSH_ENABLED_EVENTS', async () => {
  const sends = [];
  const pushService = { sendToUser: async (...args) => { sends.push(args); } };
  const dispatcher = new PushDispatcher(pushService);

  await dispatcher.handleNotificationCreated({
    userId: 'u1',
    notification: { id: 'n1', userId: 'u1', orderId: null, listingId: null, eventType: 'random.unknown', title: 'X', message: 'Y', metadata: null }
  });

  assert.equal(sends.length, 0);
});

test('PushDispatcher pushes events in PUSH_ENABLED_EVENTS', async () => {
  const sends = [];
  const pushService = { sendToUser: async (uid, payload) => { sends.push({ uid, payload }); } };
  const dispatcher = new PushDispatcher(pushService);

  // Pick the first enabled event
  const eventType = Object.keys(PUSH_ENABLED_EVENTS)[0];

  await dispatcher.handleNotificationCreated({
    userId: 'u1',
    notification: {
      id: 'n1', userId: 'u1', orderId: 'o1', listingId: null,
      eventType, title: 'Sale!', message: 'You sold a voucher', metadata: null
    },
    actorUserId: 'u2'
  });

  assert.equal(sends.length, 1);
  assert.equal(sends[0].uid, 'u1');
  assert.equal(sends[0].payload.actorUserId, 'u2');
  assert.equal(sends[0].payload.entityId, 'o1');
});
```

- [ ] **Step 5: Run tests**

```bash
yarn workspace vouchrex-api test --test-name-pattern="PushDispatcher"
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/push/push.events.ts \
        apps/api/src/modules/push/push.dispatcher.ts \
        apps/api/test/push.dispatcher.test.cjs
git commit -m "feat(push): add PushDispatcher + event-type mapping"
```

---

## Task 7: Build push controller + DTO

**Files:**
- Create: `apps/api/src/modules/push/dto/register-push-token.dto.ts`
- Create: `apps/api/src/modules/push/push.controller.ts`

- [ ] **Step 1: DTO**

`apps/api/src/modules/push/dto/register-push-token.dto.ts`:

```ts
import { IsEnum, IsString, MinLength } from 'class-validator';
import { Platform } from '@prisma/client';

export class RegisterPushTokenDto {
  @IsString()
  @MinLength(1)
  deviceId!: string;

  @IsString()
  @MinLength(1)
  token!: string;

  @IsEnum(Platform)
  platform!: Platform;
}
```

- [ ] **Step 2: Controller**

Look at `apps/api/src/modules/notifications/notifications.controller.ts` (or any controller that uses `x-session-token` auth) for the auth pattern. Then `apps/api/src/modules/push/push.controller.ts`:

```ts
import { Body, Controller, Delete, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushClient } from './expo-push.client';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

@ApiTags('push')
@Controller('me/push-tokens')
export class PushController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly expoClient: ExpoPushClient
  ) {}

  @Post()
  async register(
    @Headers('x-session-token') sessionToken: string | undefined,
    @Body() dto: RegisterPushTokenDto
  ) {
    const user = await this.requireUser(sessionToken);

    if (!this.expoClient.isValidToken(dto.token)) {
      throw new UnauthorizedException('Invalid Expo push token');
    }

    return this.prisma.pushToken.upsert({
      where: { userId_deviceId: { userId: user.id, deviceId: dto.deviceId } },
      create: { userId: user.id, deviceId: dto.deviceId, token: dto.token, platform: dto.platform },
      update: { token: dto.token, platform: dto.platform }
    });
  }

  @Delete(':deviceId')
  async unregister(
    @Headers('x-session-token') sessionToken: string | undefined,
    @Param('deviceId') deviceId: string
  ) {
    const user = await this.requireUser(sessionToken);
    await this.prisma.pushToken.deleteMany({
      where: { userId: user.id, deviceId }
    });
    return { ok: true };
  }

  private async requireUser(sessionToken: string | undefined) {
    if (!sessionToken) throw new UnauthorizedException();
    const user = await this.authService.getSessionUser(sessionToken);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
```

> Match the exact auth helper used by other controllers — if the codebase uses `getSessionUser` differently, adapt accordingly. If there is a `@CurrentUser()` decorator, prefer that.

- [ ] **Step 3: Typecheck + lint**

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/push/push.controller.ts \
        apps/api/src/modules/push/dto/register-push-token.dto.ts
git commit -m "feat(push): add /me/push-tokens controller"
```

---

## Task 8: Wire `PushModule` into `app.module.ts`

**Files:**
- Create: `apps/api/src/modules/push/push.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Module file**

```ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ExpoPushClient } from './expo-push.client';
import { PushController } from './push.controller';
import { PushDispatcher } from './push.dispatcher';
import { PushService } from './push.service';

@Module({
  imports: [PrismaModule, AuthModule, RealtimeModule],
  controllers: [PushController],
  providers: [ExpoPushClient, PushService, PushDispatcher],
  exports: [PushService]
})
export class PushModule {}
```

(If `RealtimeModule` doesn't currently `export` the gateway, modify it to export `RealtimeGateway` so `PushService` can inject it.)

- [ ] **Step 2: Register in `app.module.ts`**

In `apps/api/src/app.module.ts`, add `PushModule` to the imports array.

- [ ] **Step 3: Run full API test suite + start server**

```bash
yarn workspace vouchrex-api test
yarn workspace vouchrex-api typecheck
make api-dev    # start once, ctrl-c after server boots successfully
```

Confirm the server boots without DI errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/push/push.module.ts \
        apps/api/src/app.module.ts \
        apps/api/src/modules/realtime/realtime.module.ts
git commit -m "feat(push): wire PushModule into Nest app"
```

---

## Task 9: Add mobile dependencies

**Files:**
- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Install**

```bash
yarn workspace vouchrex-mobile add expo-notifications expo-application
```

- [ ] **Step 2: Configure plugin**

Read `apps/mobile/app.config.ts` (or `app.json`). Add `'expo-notifications'` to the `plugins` array. If using app.config.ts, the entry might look like:

```ts
plugins: [
  // ... existing plugins,
  [
    'expo-notifications',
    {
      icon: './assets/notification-icon.png',  // optional
      color: '#ffffff',
      defaultChannel: 'default'
    }
  ]
]
```

If a notification icon asset doesn't exist, omit the `icon` line — the default app icon is used.

- [ ] **Step 3: Typecheck**

```bash
yarn workspace vouchrex-mobile typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json yarn.lock apps/mobile/app.config.ts
git commit -m "chore(mobile): add expo-notifications and expo-application"
```

---

## Task 10: Add API helpers for push registration

**Files:**
- Modify: `apps/mobile/src/lib/api.ts`

- [ ] **Step 1: Add functions**

Find the existing API functions in `apps/mobile/src/lib/api.ts` and follow the same style. Add:

```ts
export async function registerPushToken(
  sessionToken: string,
  body: { deviceId: string; token: string; platform: 'IOS' | 'ANDROID' | 'WEB' }
) {
  return request('POST', '/me/push-tokens', { sessionToken, body });
}

export async function unregisterPushToken(sessionToken: string, deviceId: string) {
  return request('DELETE', `/me/push-tokens/${encodeURIComponent(deviceId)}`, { sessionToken });
}
```

(Adapt to whatever `request` helper or `api.foo` shape this file actually uses. Read it first.)

- [ ] **Step 2: Typecheck + commit**

```bash
git add apps/mobile/src/lib/api.ts
git commit -m "feat(mobile): add push token API client helpers"
```

---

## Task 11: Build `apps/mobile/src/lib/push.ts`

**Files:**
- Create: `apps/mobile/src/lib/push.ts`

- [ ] **Step 1: Create the module**

```ts
import * as Application from 'expo-application';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from './api';

export type PushPlatform = 'IOS' | 'ANDROID' | 'WEB';

function detectPlatform(): PushPlatform {
  if (Platform.OS === 'ios') return 'IOS';
  if (Platform.OS === 'android') return 'ANDROID';
  return 'WEB';
}

async function getDeviceId(): Promise<string> {
  if (Platform.OS === 'android') {
    return Application.getAndroidId() ?? 'unknown-android';
  }
  return (await Application.getIosIdForVendorAsync()) ?? 'unknown-ios';
}

export async function registerForPush(sessionToken: string): Promise<void> {
  const settings = await Notifications.getPermissionsAsync();
  let granted = settings.granted;

  if (!granted) {
    const ask = await Notifications.requestPermissionsAsync();
    granted = ask.granted;
  }
  if (!granted) return;

  const tokenResult = await Notifications.getExpoPushTokenAsync();
  const deviceId = await getDeviceId();

  await api.registerPushToken(sessionToken, {
    deviceId,
    token: tokenResult.data,
    platform: detectPlatform()
  });
}

export async function unregisterFromPush(sessionToken: string): Promise<void> {
  const deviceId = await getDeviceId();
  try {
    await api.unregisterPushToken(sessionToken, deviceId);
  } catch {
    // best-effort
  }
}

/**
 * Configure foreground notification behavior. Showing a banner in foreground
 * is suppressed because the app shows its own toast via NotificationCenterProvider.
 */
export function configureForegroundBehavior(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false
    })
  });
}

/**
 * Subscribes to taps on OS notifications. Calls `onTap(link)` with the
 * `data.link` field. Returns a cleanup function.
 */
export function subscribeToNotificationTaps(onTap: (link: string) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const link = response.notification.request.content.data?.link;
    if (typeof link === 'string') onTap(link);
  });
  return () => sub.remove();
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
git add apps/mobile/src/lib/push.ts
git commit -m "feat(mobile): add push registration + tap-handling library"
```

---

## Task 12: Build `usePushRegistrar` hook

**Files:**
- Create: `apps/mobile/src/hooks/use-push-registrar.tsx`

- [ ] **Step 1: Create the hook**

```tsx
import React, { useEffect } from 'react';
import { router } from 'expo-router';

import { useAuth } from './use-auth';
import {
  configureForegroundBehavior,
  registerForPush,
  subscribeToNotificationTaps,
  unregisterFromPush
} from '@/lib/push';

export function PushRegistrar({ children }: { readonly children: React.ReactNode }) {
  const { sessionToken, status } = useAuth();

  useEffect(() => {
    configureForegroundBehavior();
    const cleanup = subscribeToNotificationTaps((link) => { router.push(link as never); });
    return cleanup;
  }, []);

  useEffect(() => {
    if (status === 'signedIn' && sessionToken) {
      void registerForPush(sessionToken);
    }
  }, [status, sessionToken]);

  return <>{children}</>;
}
```

> Sign-out cleanup: `useAuth` should call `unregisterFromPush(sessionToken)` BEFORE clearing the session token. If the auth provider doesn't currently have a sign-out hook, add it. Read `apps/mobile/src/hooks/use-auth.tsx` first to find the sign-out path.

- [ ] **Step 2: Wire sign-out cleanup in `use-auth.tsx`**

In `apps/mobile/src/hooks/use-auth.tsx`, find the `signOut` function (or whatever clears the session). Before clearing the token from secure storage, add:

```ts
import { unregisterFromPush } from '@/lib/push';

// Inside signOut, BEFORE clearing the session:
if (sessionToken) {
  await unregisterFromPush(sessionToken);
}
```

The `unregisterFromPush` is best-effort; failures should not block sign-out.

- [ ] **Step 3: Typecheck + commit**

```bash
git add apps/mobile/src/hooks/use-push-registrar.tsx \
        apps/mobile/src/hooks/use-auth.tsx
git commit -m "feat(mobile): register push token on sign-in, deregister on sign-out"
```

---

## Task 13: Mount `PushRegistrar` in root layout

**Files:**
- Modify: `apps/mobile/src/app/_layout.tsx`

- [ ] **Step 1: Wrap inside `SocketProvider`**

In `apps/mobile/src/app/_layout.tsx` `InnerApp`:

```tsx
import { PushRegistrar } from '@/hooks/use-push-registrar';

// Inside InnerApp's JSX, wrap NotificationCenterProvider:
<SocketProvider>
  <PushRegistrar>
    <NotificationCenterProvider>
      <AppStack />
      <Toast />
    </NotificationCenterProvider>
  </PushRegistrar>
</SocketProvider>
```

- [ ] **Step 2: Typecheck + commit**

```bash
git add apps/mobile/src/app/_layout.tsx
git commit -m "feat(mobile): mount PushRegistrar in root layout"
```

---

## Task 14: Smoke test of full module wiring

**Files:** none (verification only)

- [ ] **Step 1: Full API tests**

```bash
yarn workspace vouchrex-api test
yarn workspace vouchrex-api typecheck
yarn workspace vouchrex-api lint
```

- [ ] **Step 2: Full mobile checks**

```bash
yarn workspace vouchrex-mobile typecheck
make lint
```

- [ ] **Step 3: Boot the API**

```bash
make infra-up
make migrate
make api-dev    # ctrl-c after seeing "Listening on port 3010"
```

Confirm no startup errors. Confirm the new `/me/push-tokens` route appears in Swagger at `http://localhost:3010/docs`.

- [ ] **Step 4: No commit needed**

---

## Spec coverage check

| Spec requirement (Phase 1B) | Implemented in |
|---|---|
| `PushToken` Prisma model with `Platform IOS/ANDROID/WEB` | Task 1 |
| `expo-server-sdk` server dep | Task 2 |
| `EXPO_ACCESS_TOKEN` env (optional in dev) | Task 2 |
| `ExpoPushClient` (chunking, validation, batch send) | Task 3 |
| `PushService` (dedup, actor suppression, foreground suppression, dead-token cleanup) | Tasks 4–5 |
| `RealtimeGateway.isUserConnected` helper | Task 5 |
| `PushDispatcher` listening to `notification.created` | Task 6 |
| Event-type → push payload mapping | Task 6 |
| `POST /me/push-tokens`, `DELETE /me/push-tokens/:deviceId` | Task 7 |
| `PushModule` wired into `app.module.ts` | Task 8 |
| `expo-notifications` + `expo-application` mobile deps | Task 9 |
| Mobile API helpers `registerPushToken` / `unregisterPushToken` | Task 10 |
| `apps/mobile/src/lib/push.ts` (register, unregister, foreground config, tap subscriber) | Task 11 |
| `PushRegistrar` hook + sign-out cleanup | Task 12 |
| Mount in root layout | Task 13 |
| Tap-to-deep-link via `data.link` | Task 11 (`subscribeToNotificationTaps`) wired in Task 12 |
| Smoke verification | Task 14 |
