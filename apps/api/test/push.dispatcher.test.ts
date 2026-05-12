import test from 'node:test';
import assert from 'node:assert/strict';

import { PushDispatcher } from '../src/modules/push/push.dispatcher';
import { PUSH_ENABLED_EVENTS } from '../src/modules/push/push.events';

test('PushDispatcher does NOT push events not in PUSH_ENABLED_EVENTS', async () => {
  const sends: any[] = [];
  const pushService: any = { sendToUser: async (...args: any[]) => { sends.push(args); } };
  const dispatcher = new PushDispatcher(pushService);

  await dispatcher.handleNotificationCreated({
    userId: 'u1',
    notification: { id: 'n1', userId: 'u1', orderId: null, listingId: null, eventType: 'random.unknown', title: 'X', message: 'Y', metadata: null }
  } as any);

  assert.equal(sends.length, 0);
});

test('PushDispatcher pushes events in PUSH_ENABLED_EVENTS with correct payload', async () => {
  const sends: any[] = [];
  const pushService: any = { sendToUser: async (uid: string, payload: any) => { sends.push({ uid, payload }); } };
  const dispatcher = new PushDispatcher(pushService);

  const eventType = Object.keys(PUSH_ENABLED_EVENTS)[0];

  await dispatcher.handleNotificationCreated({
    userId: 'u1',
    notification: {
      id: 'n1', userId: 'u1', orderId: 'o1', listingId: null,
      eventType, title: 'Sale!', message: 'You sold a voucher', metadata: null
    },
    actorUserId: 'u2'
  } as any);

  assert.equal(sends.length, 1);
  assert.equal(sends[0].uid, 'u1');
  assert.equal(sends[0].payload.actorUserId, 'u2');
  assert.equal(sends[0].payload.entityId, 'o1');
  assert.equal(sends[0].payload.eventType, eventType);
});
