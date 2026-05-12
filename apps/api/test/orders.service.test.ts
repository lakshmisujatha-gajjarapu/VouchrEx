import test from 'node:test';
import assert from 'node:assert/strict';

import { OrdersService } from '../src/modules/orders/orders.service';

test('OrdersService reveals a watermarked code and starts the verification timer', async () => {
  const notifications: any[] = [];
  const txCalls: any[] = [];

  const prisma: any = {
    order: {
      findUnique: async () => ({
        id: 'order_1',
        listingId: 'listing_1',
        buyerId: 'buyer_1',
        status: 'ESCROW_ACTIVE',
        verificationDeadline: null,
        codeRevealedAt: null,
        listing: {
          id: 'listing_1',
          faceValue: 500,
          brand: {
            name: 'Amazon',
            verificationWindowHours: 2
          },
          codeVault: {
            encryptedCode: 'cipher',
            encryptionIv: 'iv',
            encryptionTag: 'tag',
            viewCount: 0,
            firstViewedAt: null
          }
        },
        buyer: {
          id: 'buyer_1',
          name: 'Priya',
          phone: '+919876543210'
        },
        seller: {
          id: 'seller_1',
          name: 'Rahul'
        },
        payment: {
          id: 'payment_1'
        }
      })
    },
    $transaction: async (callback: any) =>
      callback({
        order: {
          update: async ({ data }: any) => {
            txCalls.push(['order.update', data]);
            return data;
          }
        },
        codeVault: {
          update: async ({ data }: any) => {
            txCalls.push(['codeVault.update', data]);
            return data;
          }
        },
        auditLog: {
          create: async ({ data }: any) => {
            txCalls.push(['auditLog.create', data]);
            return data;
          }
        }
      })
  };

  const codeVaultService: any = {
    decrypt: () => 'AMZN-9X2M-47QP',
    renderWatermarkedCodeCard: () => 'data:image/svg+xml;base64,watermarked'
  };

  const notificationsService: any = {
    createMany: async (items: any[]) => {
      notifications.push(...items);
      return items;
    }
  };

  const paymentsService: any = {};
  const eventEmitter: any = {
    emit: () => {}
  };
  const service = new OrdersService(
    prisma,
    codeVaultService,
    notificationsService,
    paymentsService,
    eventEmitter
  );

  const result = await service.revealCode('order_1', 'buyer_1');

  assert.equal(result.watermarkedCodeImageUrl, 'data:image/svg+xml;base64,watermarked');
  assert.equal(result.revealCount, 1);
  assert.equal(result.verificationWindowHours, 2);
  assert.equal(notifications.length, 2);
  assert.deepEqual(
    txCalls.map(([name]) => name),
    ['order.update', 'codeVault.update', 'auditLog.create']
  );
});
