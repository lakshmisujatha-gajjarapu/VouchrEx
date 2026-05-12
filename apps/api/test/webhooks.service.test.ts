import test from 'node:test';
import assert from 'node:assert/strict';

import { WebhooksService } from '../src/modules/webhooks/webhooks.service';

test('handleRazorpayEvent processes the same eventId only once', async () => {
  let dispatchCount = 0;
  const created: string[] = [];
  const updated: any[] = [];

  const prisma: any = {
    webhookEvent: {
      create: async (a: any) => {
        if (created.includes(a.data.eventId)) {
          const e: any = new Error('Unique constraint failed on the fields: (`eventId`)');
          e.code = 'P2002';
          throw e;
        }
        created.push(a.data.eventId);
        return a.data;
      },
      update: async (a: any) => {
        updated.push(a);
        return {};
      }
    }
  };

  const ordersService: any = {
    activateEscrowForOrder: async () => { dispatchCount++; },
    handlePayoutWebhook: async () => {}
  };

  const svc = new WebhooksService(prisma, ordersService);

  const body = {
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_1', order_id: 'ord_1' } } }
  };

  await svc.handleRazorpayEvent(body, 'evt_1');
  await svc.handleRazorpayEvent(body, 'evt_1');

  assert.equal(dispatchCount, 1, 'dispatch must run exactly once for duplicate eventId');
  assert.equal(updated.length, 1, 'processedAt should be set once');
  assert.ok(updated[0].data.processedAt instanceof Date, 'processedAt must be a Date');
});

test('handleRazorpayEvent records error and rethrows when downstream handler throws', async () => {
  const updated: any[] = [];

  const prisma: any = {
    webhookEvent: {
      create: async () => ({}),
      update: async (a: any) => {
        updated.push(a);
        return {};
      }
    }
  };

  const ordersService: any = {
    activateEscrowForOrder: async () => { throw new Error('downstream boom'); },
    handlePayoutWebhook: async () => {}
  };

  const svc = new WebhooksService(prisma, ordersService);

  await assert.rejects(
    () => svc.handleRazorpayEvent(
      { event: 'payment.captured', payload: { payment: { entity: { id: 'p', order_id: 'o' } } } },
      'evt_2'
    ),
    /downstream/i
  );

  assert.ok(
    updated.some((u) => typeof u.data?.error === 'string'),
    'error field must be set on failure'
  );
});

test('handleRazorpayEvent skips malformed body without touching DB', async () => {
  let createCalled = false;

  const prisma: any = {
    webhookEvent: {
      create: async () => { createCalled = true; return {}; },
      update: async () => ({})
    }
  };

  const ordersService: any = {
    activateEscrowForOrder: async () => {},
    handlePayoutWebhook: async () => {}
  };

  const svc = new WebhooksService(prisma, ordersService);

  await svc.handleRazorpayEvent(null, 'evt_bad');
  await svc.handleRazorpayEvent({ no_event_key: true }, 'evt_bad2');

  assert.equal(createCalled, false, 'DB must not be touched for malformed webhooks');
});

test('handleRazorpayEvent marks processedAt for unknown (ignored) events', async () => {
  const updated: any[] = [];

  const prisma: any = {
    webhookEvent: {
      create: async () => ({}),
      update: async (a: any) => { updated.push(a); return {}; }
    }
  };

  const ordersService: any = {
    activateEscrowForOrder: async () => {},
    handlePayoutWebhook: async () => {},
    handleRefundWebhook: async () => {}
  };

  const svc = new WebhooksService(prisma, ordersService);

  await svc.handleRazorpayEvent({ event: 'order.paid' }, 'evt_unknown');

  assert.equal(updated.length, 1, 'processedAt should be set for ignored events');
  assert.ok(updated[0].data.processedAt instanceof Date, 'processedAt must be a Date');
});

test('refund.processed webhook dispatches to ordersService.handleRefundWebhook', async () => {
  let received: any = null;
  const prisma: any = {
    webhookEvent: { create: async () => ({}), update: async () => ({}) }
  };
  const ordersService: any = {
    activateEscrowForOrder: async () => {},
    handlePayoutWebhook: async () => {},
    handleRefundWebhook: async (notes: any, refund: any) => { received = { notes, refund }; }
  };
  const { WebhooksService } = require('../src/modules/webhooks/webhooks.service');
  const svc = new WebhooksService(prisma, ordersService);
  await svc.handleRazorpayEvent({
    event: 'refund.processed',
    payload: { refund: { entity: { id: 'rfnd_1', status: 'processed', notes: { orderId: 'order_1' } } } }
  }, 'evt_rfnd_1');
  assert.equal(received.refund.id, 'rfnd_1');
  assert.equal(received.notes.orderId, 'order_1');
});
