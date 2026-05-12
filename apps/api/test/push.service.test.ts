import test from 'node:test';
import assert from 'node:assert/strict';

import { PushService } from '../src/modules/push/push.service';

function makeService({
  pushTokens = [],
  realtimeConnected = false,
  sendResult = []
}: { pushTokens?: any[]; realtimeConnected?: boolean; sendResult?: any[] } = {}) {
  const sentBatches: any[] = [];
  const deletedIds: string[] = [];
  const prisma: any = {
    pushToken: {
      findMany: async () => pushTokens,
      deleteMany: async ({ where }: any) => { deletedIds.push(...where.id.in); return { count: where.id.in.length }; }
    }
  };
  const expoClient: any = {
    isValidToken: () => true,
    sendChunked: async (messages: any) => { sentBatches.push(messages); return sendResult; }
  };
  const realtimeGateway: any = { isUserConnected: async () => realtimeConnected };
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
