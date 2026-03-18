const test = require('node:test');
const assert = require('node:assert/strict');

require('ts-node/register/transpile-only');

const { OrdersService } = require('../src/modules/orders/orders.service.ts');

test('OrdersService reveals a watermarked code and starts the verification timer', async () => {
  const notifications = [];
  const txCalls = [];

  const prisma = {
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
    $transaction: async (callback) =>
      callback({
        order: {
          update: async ({ data }) => {
            txCalls.push(['order.update', data]);
            return data;
          }
        },
        codeVault: {
          update: async ({ data }) => {
            txCalls.push(['codeVault.update', data]);
            return data;
          }
        },
        auditLog: {
          create: async ({ data }) => {
            txCalls.push(['auditLog.create', data]);
            return data;
          }
        }
      })
  };

  const codeVaultService = {
    decrypt: () => 'AMZN-9X2M-47QP',
    renderWatermarkedCodeCard: () => 'data:image/svg+xml;base64,watermarked'
  };

  const notificationsService = {
    createMany: async (items) => {
      notifications.push(...items);
      return items;
    }
  };

  const paymentsService = {};
  const service = new OrdersService(
    prisma,
    codeVaultService,
    notificationsService,
    paymentsService
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
