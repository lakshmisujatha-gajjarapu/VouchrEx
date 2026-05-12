import test from 'node:test';
import assert from 'node:assert/strict';

import { Prisma } from '@prisma/client';
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
          id: 'payment_1',
          status: 'CAPTURED'
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

test('executeAndRecordRefund uses a stable idempotency key regardless of refundAttempts', async () => {
  const capturedKeys: string[] = [];
  const orderId = 'order_idem_test';

  // Simulate refundAttempts changing between two retry calls (3 then 7)
  let findUniqueCallCount = 0;
  const refundAttemptValues = [3, 7];

  const prisma: any = {
    payment: {
      findUnique: async () => ({
        refundAttempts: refundAttemptValues[findUniqueCallCount++] ?? 1
      }),
      update: async () => ({})
    },
    auditLog: {
      create: async () => ({})
    }
  };

  const paymentsService: any = {
    executeRefund: async (
      _razorpayPaymentId: string,
      _amount: number,
      opts: { idempotencyKey: string }
    ) => {
      capturedKeys.push(opts.idempotencyKey);
      return { razorpayRefundId: 'rfnd_test_123' };
    }
  };

  const service = new OrdersService(
    prisma,
    null as any,
    null as any,
    paymentsService,
    null as any,
    null as any
  );

  // Call the private method twice with different simulated refundAttempts states
  await (service as any).executeAndRecordRefund(orderId, 'pay_razorpay_1', 500, 'dispute_1', null);
  await (service as any).executeAndRecordRefund(orderId, 'pay_razorpay_1', 500, 'dispute_1', null);

  assert.equal(capturedKeys.length, 2, 'executeRefund should have been called twice');
  assert.equal(capturedKeys[0], capturedKeys[1], 'idempotency key must be identical on retry');
  assert.equal(capturedKeys[0], `refund-${orderId}`, 'key must be refund-<orderId> with no attempt suffix');
  assert.ok(!capturedKeys[0].includes('-3'), 'key must not include refundAttempts value 3');
  assert.ok(!capturedKeys[0].includes('-7'), 'key must not include refundAttempts value 7');
});

test('retryDisputeRefund adopts existing Razorpay refund without POSTing again', async () => {
  const orderId = 'order_retry_preflight';
  const razorpayPaymentId = 'pay_razorpay_preflight';

  const paymentUpdateCalls: any[] = [];
  const auditLogCreateCalls: any[] = [];

  const prisma: any = {
    order: {
      findUnique: async () => ({
        id: orderId,
        payment: {
          id: 'payment_preflight',
          status: 'CAPTURED',
          refundStatus: 'FAILED',
          razorpayPaymentId,
          amount: 1000,
          refundAttempts: 1
        },
        dispute: {
          id: 'dispute_preflight'
        }
      })
    },
    payment: {
      update: async ({ data }: any) => {
        paymentUpdateCalls.push(data);
        return data;
      },
      findUnique: async () => ({ id: 'payment_preflight', refundStatus: 'COMPLETED' })
    },
    auditLog: {
      create: async ({ data }: any) => {
        auditLogCreateCalls.push(data);
        return data;
      }
    }
  };

  let executeRefundCalled = false;
  const paymentsService: any = {
    fetchRefundsForPayment: async (_id: string) => [
      { id: 'rfnd_existing', status: 'processed', amount: 1000, notes: { orderId } }
    ],
    executeRefund: async () => {
      executeRefundCalled = true;
      throw new Error('must not be called');
    }
  };

  const service = new OrdersService(
    prisma,
    null as any,
    null as any,
    paymentsService,
    null as any,
    null as any
  );

  const result = await service.retryDisputeRefund(orderId, 'admin_1');

  assert.ok(!executeRefundCalled, 'executeRefund must NOT be called when Razorpay already has a processed refund');
  assert.equal(paymentUpdateCalls.length, 1, 'payment.update should be called once to adopt the remote state');
  assert.equal(paymentUpdateCalls[0].refundStatus, 'COMPLETED', 'refundStatus must be set to COMPLETED');
  assert.equal(paymentUpdateCalls[0].razorpayRefundId, 'rfnd_existing', 'razorpayRefundId must be adopted from Razorpay');
  assert.equal(auditLogCreateCalls.length, 1, 'audit log must be created');
  assert.equal(auditLogCreateCalls[0].action, 'payment.refund_recovered_from_razorpay');
  assert.ok(result !== undefined, 'should return the updated payment');
});

test('activateEscrow is idempotent: second call does not duplicate notifications or audit', async () => {
  let updateManyCount = 0;
  const auditWrites: any[] = [];
  const notifyCalls: any[] = [];
  const emits: any[] = [];

  const prismaInner: any = {
    order: {
      updateMany: async () => {
        updateManyCount++;
        return { count: updateManyCount === 1 ? 1 : 0 };
      },
      findUnique: async () => ({ id: 'order_1', payment: {}, listing: { brand: { name: 'X' } } })
    },
    payment: {
      update: async () => ({}),
      create: async () => ({})
    },
    auditLog: { create: async (a: any) => { auditWrites.push(a); return {}; } }
  };
  const prisma: any = {
    ...prismaInner,
    order: {
      ...prismaInner.order,
      findUnique: prismaInner.order.findUnique
    },
    $transaction: async (fn: any) => fn(prismaInner)
  };
  const baseOrder = {
    id: 'order_1', buyerId: 'b', sellerId: 's', listingId: 'l',
    amount: 100, platformFee: 5,
    buyer: { id: 'b', name: 'B', phone: '1' },
    seller: { id: 's', name: 'S', phone: '2' },
    listing: { brand: { name: 'Amazon' } },
    payment: { provider: 'RAZORPAY', currency: 'INR' }
  };
  // First findUnique returns the order with payment for the initial path; subsequent calls also return order.
  prisma.order.findUnique = async () => baseOrder;

  const notifications: any = { createMany: async (n: any) => { notifyCalls.push(n); } };
  const eventEmitter: any = { emit: (...a: any) => { emits.push(a); } };
  const svc: any = new OrdersService(prisma, null, notifications, null, eventEmitter, null);

  await (svc as any).activateEscrow('order_1', { method: 'card' });
  await (svc as any).activateEscrow('order_1', { method: 'card' });

  assert.equal(notifyCalls.length, 1, 'notifications must fire only once');
  assert.equal(auditWrites.length, 1, 'audit log must be written only once');
  assert.equal(emits.filter((e) => e[0] === 'order.updated').length, 1, 'order.updated emitted only once');
});

test('finalizeRelease is idempotent: second call does not duplicate executePayout', async () => {
  let updateManyCallCount = 0;
  let payoutCallCount = 0;

  const orderId = 'order_fr_idem';

  const baseOrder = {
    id: orderId,
    buyerId: 'b',
    sellerId: 's',
    listingId: 'l',
    sellerPayout: 950,
    buyer: { id: 'b', name: 'B' },
    seller: {
      id: 's',
      name: 'S',
      payoutHoldUntil: null,
      payoutAccount: {
        razorpayFundAccountId: 'fa_1',
        kycStatus: 'VERIFIED',
        type: 'bank',
        upiId: null
      }
    },
    listing: { id: 'l', brand: { name: 'TestBrand' } },
    payment: { id: 'payment_fr_idem', orderId }
  };

  const prismaInner: any = {
    order: {
      updateMany: async () => {
        updateManyCallCount++;
        return { count: updateManyCallCount === 1 ? 1 : 0 };
      },
      findUnique: async () => ({ ...baseOrder, listing: { id: 'l', brand: { name: 'TestBrand' } }, payment: { id: 'payment_fr_idem' } })
    },
    voucherListing: {
      update: async () => ({})
    },
    payment: {
      update: async () => ({})
    },
    auditLog: {
      create: async () => ({})
    }
  };

  const prisma: any = {
    ...prismaInner,
    order: {
      ...prismaInner.order,
      findUnique: async () => baseOrder
    },
    user: {
      update: async () => ({})
    },
    $transaction: async (fn: any) => fn(prismaInner)
  };

  const paymentsService: any = {
    isRazorpayXEnabled: () => true,
    executePayout: async () => {
      payoutCallCount++;
      return 'pout_1';
    }
  };

  const notificationsService: any = { createMany: async () => {} };
  const eventEmitter: any = { emit: () => {} };

  const svc: any = new OrdersService(prisma, null, notificationsService, paymentsService, eventEmitter, null);

  await (svc as any).finalizeRelease(orderId, 'CONFIRMED', new Date(), null);
  await (svc as any).finalizeRelease(orderId, 'CONFIRMED', new Date(), null);

  assert.equal(payoutCallCount, 1, 'executePayout must be called exactly once');
});

test('finalizeRelease payout catch does not overwrite a successful payout state', async () => {
  const orderId = 'order_fr_catch';

  const updateManyCalls: any[] = [];

  const baseOrder = {
    id: orderId,
    buyerId: 'b',
    sellerId: 's',
    listingId: 'l',
    sellerPayout: 950,
    buyer: { id: 'b', name: 'B' },
    seller: {
      id: 's',
      name: 'S',
      payoutHoldUntil: null,
      payoutAccount: {
        razorpayFundAccountId: 'fa_1',
        kycStatus: 'VERIFIED',
        type: 'bank',
        upiId: null
      }
    },
    listing: { id: 'l', brand: { name: 'TestBrand' } },
    payment: { id: 'payment_fr_catch', orderId, razorpayPayoutId: 'pout_already_set' }
  };

  const prismaInner: any = {
    order: {
      updateMany: async () => ({ count: 1 }),
      findUnique: async () => ({ ...baseOrder, listing: { id: 'l', brand: { name: 'TestBrand' } }, payment: { id: 'payment_fr_catch' } })
    },
    voucherListing: {
      update: async () => ({})
    },
    payment: {
      update: async () => ({})
    },
    auditLog: {
      create: async () => ({})
    }
  };

  const prisma: any = {
    ...prismaInner,
    order: {
      ...prismaInner.order,
      findUnique: async () => baseOrder
    },
    user: {
      update: async () => ({})
    },
    payment: {
      update: async () => ({}),
      updateMany: async (args: any) => {
        updateManyCalls.push(args);
        return { count: 0 };
      }
    },
    auditLog: {
      create: async () => ({})
    },
    $transaction: async (fn: any) => fn(prismaInner)
  };

  const paymentsService: any = {
    isRazorpayXEnabled: () => true,
    executePayout: async () => {
      throw new Error('duplicate payout 4xx from Razorpay');
    }
  };

  const notificationsService: any = { createMany: async () => {} };
  const eventEmitter: any = { emit: () => {} };

  const svc: any = new OrdersService(prisma, null, notificationsService, paymentsService, eventEmitter, null);

  await (svc as any).finalizeRelease(orderId, 'CONFIRMED', new Date(), null);

  assert.equal(updateManyCalls.length, 1, 'payment.updateMany must be called once in the catch block');
  assert.deepEqual(
    updateManyCalls[0].where,
    { orderId, razorpayPayoutId: null },
    'catch must filter with razorpayPayoutId: null to avoid overwriting a successful payout'
  );
});

test('cancelExpiredEscrowOrders auto-executes a Razorpay refund when razorpayPaymentId is present', async () => {
  let refundCalled = false;
  let refundedAmount = 0;
  const paymentsService: any = {
    executeRefund: async (paymentId: string, amount: number) => {
      refundCalled = true;
      refundedAmount = amount;
      return { razorpayRefundId: 'rfnd_expired_1' };
    }
  };
  const expiredOrder = {
    id: 'order_exp', listingId: 'l', buyerId: 'b', sellerId: 's',
    buyer: { id: 'b', name: 'B' }, seller: { id: 's', name: 'S' },
    listing: { brand: { name: 'X' }, expiryDate: new Date(Date.now() - 1000) },
    payment: { razorpayPaymentId: 'pay_1', amount: 100, refundAttempts: 0 }
  };
  const prisma: any = {
    order: {
      findMany: async () => [expiredOrder],
      update: async () => ({})
    },
    voucherListing: { updateMany: async () => ({ count: 1 }) },
    payment: { update: async () => ({}), findUnique: async () => ({ refundAttempts: 1 }) },
    auditLog: { create: async () => ({}) },
    $transaction: async (fn: any) => fn(prisma)
  };
  const notifications: any = { createMany: async () => {} };
  const eventEmitter: any = { emit: () => {} };
  const { OrdersService } = require('../src/modules/orders/orders.service');
  const svc: any = new OrdersService(prisma, null, notifications, paymentsService, eventEmitter, null);

  await svc.cancelExpiredEscrowOrders();

  assert.equal(refundCalled, true);
  assert.equal(refundedAmount, 100);
});

test('cancelExpiredEscrowOrders marks FAILED when payment has no razorpayPaymentId', async () => {
  let failedReason: string | null = null;
  const expiredOrder = {
    id: 'order_exp2', listingId: 'l', buyerId: 'b', sellerId: 's',
    buyer: { id: 'b', name: 'B' }, seller: { id: 's', name: 'S' },
    listing: { brand: { name: 'X' }, expiryDate: new Date(Date.now() - 1000) },
    payment: { razorpayPaymentId: null, amount: 100, refundAttempts: 0 }
  };
  const prisma: any = {
    order: { findMany: async () => [expiredOrder], update: async () => ({}) },
    voucherListing: { updateMany: async () => ({ count: 1 }) },
    payment: { update: async (a: any) => { if (a.data?.refundStatus === 'FAILED') failedReason = a.data.refundFailureReason; return {}; } },
    auditLog: { create: async () => ({}) },
    $transaction: async (fn: any) => fn(prisma)
  };
  const paymentsService: any = { executeRefund: async () => { throw new Error('must not be called'); } };
  const notifications: any = { createMany: async () => {} };
  const eventEmitter: any = { emit: () => {} };
  const { OrdersService } = require('../src/modules/orders/orders.service');
  const svc: any = new OrdersService(prisma, null, notifications, paymentsService, eventEmitter, null);

  await svc.cancelExpiredEscrowOrders();

  assert.match(failedReason ?? '', /no razorpayPaymentId/i);
});

test('confirm throws BadRequest when order is not in CODE_REVEALED (race lost to dispute)', async () => {
  // requireOrder uses findUnique with payment include; finalizeRelease also calls findUnique.
  // The inner tx.order.updateMany returns count:0 simulating the order already moved to DISPUTED.
  const baseOrder = {
    id: 'o',
    buyerId: 'b',
    status: 'DISPUTED',
    payment: { status: 'CAPTURED' },
    listing: { id: 'l', brand: { name: 'X' } },
    buyer: { id: 'b', name: 'B' },
    seller: { id: 's', name: 'S', payoutHoldUntil: null, payoutAccount: null }
  };

  const prismaInner: any = {
    order: {
      updateMany: async () => ({ count: 0 }),
      findUnique: async () => baseOrder
    },
    voucherListing: { update: async () => ({}) },
    payment: { update: async () => ({}) },
    auditLog: { create: async () => ({}) }
  };

  const prisma: any = {
    ...prismaInner,
    order: {
      ...prismaInner.order,
      findUnique: async () => baseOrder
    },
    $transaction: async (fn: any) => fn(prismaInner)
  };

  const { OrdersService } = require('../src/modules/orders/orders.service');
  const svc: any = new OrdersService(
    prisma,
    null,
    { createMany: async () => {} },
    { isRazorpayXEnabled: () => false },
    { emit: () => {} },
    null
  );

  await assert.rejects(
    () => svc.confirm('o', 'b'),
    (err: any) => err.message && /confirmable/i.test(err.message)
  );
});

test('createDispute throws BadRequest when order is no longer CODE_REVEALED', async () => {
  const prismaInner: any = {
    order: {
      updateMany: async () => ({ count: 0 }) // race: order already moved
    },
    dispute: { create: async () => ({}) },
    voucherListing: { updateMany: async () => ({ count: 0 }) },
    auditLog: { create: async () => ({}) }
  };

  const prisma: any = {
    order: {
      findUnique: async () => ({
        id: 'o',
        status: 'CODE_REVEALED',
        buyerId: 'b',
        sellerId: 's',
        listingId: 'l',
        listing: { id: 'l', brand: { name: 'X' } },
        seller: { id: 's', name: 'S' }
      })
    },
    $transaction: async (fn: any) => fn(prismaInner)
  };

  const { OrdersService } = require('../src/modules/orders/orders.service');
  const svc: any = new OrdersService(
    prisma,
    null,
    { createMany: async () => {} },
    null,
    { emit: () => {} },
    null
  );

  await assert.rejects(
    () => svc.createDispute('o', { reason: 'INVALID_CODE', description: 'test', evidenceUrls: ['https://example.com/ev.png'] }, 'b'),
    (err: any) => err.message && /disputable/i.test(err.message)
  );
});

test('createDispute happy path: writes dispute row when order is CODE_REVEALED', async () => {
  let disputeCreated = false;

  const prismaInner: any = {
    order: {
      updateMany: async () => ({ count: 1 })
    },
    dispute: {
      create: async () => {
        disputeCreated = true;
        return { id: 'd', orderId: 'o' };
      }
    },
    voucherListing: { updateMany: async () => ({ count: 1 }) },
    auditLog: { create: async () => ({}) }
  };

  const prisma: any = {
    order: {
      findUnique: async () => ({
        id: 'o',
        status: 'CODE_REVEALED',
        buyerId: 'b',
        sellerId: 's',
        listingId: 'l',
        listing: { id: 'l', brand: { name: 'X' } },
        seller: { id: 's', name: 'S' }
      })
    },
    user: { update: async () => ({}) },
    $transaction: async (fn: any) => fn(prismaInner)
  };

  const { OrdersService } = require('../src/modules/orders/orders.service');
  const svc: any = new OrdersService(
    prisma,
    null,
    { createMany: async () => {} },
    null,
    { emit: () => {} },
    null
  );

  await svc.createDispute('o', { reason: 'INVALID_CODE', description: 'test', evidenceUrls: ['https://example.com/ev.png'] }, 'b');
  assert.equal(disputeCreated, true);
});

test('resolveDispute is idempotent: concurrent REFUND_BUYER calls initiate refund only once', async () => {
  let claimCount = 0;
  let refundInits = 0;
  const dispute = {
    id: 'd', orderId: 'o',
    order: {
      id: 'o', listingId: 'l',
      buyer: { id: 'b', name: 'Buyer' }, seller: { id: 's', name: 'Seller' },
      listing: { brand: { name: 'X' } }
    }
  };
  const prisma: any = {
    dispute: {
      findUnique: async () => dispute,
      updateMany: async () => {
        claimCount++;
        return { count: claimCount === 1 ? 1 : 0 };
      }
    },
    order: { updateMany: async () => ({ count: 1 }), findUnique: async () => ({ ...dispute.order, payment: null }) },
    voucherListing: { updateMany: async () => ({ count: 1 }) },
    payment: { update: async () => ({}), findUnique: async () => ({}) },
    auditLog: { create: async () => ({}) },
    $transaction: async (fn: any) => fn(prisma)
  };
  const paymentsService: any = {
    fetchRefundsForPayment: async () => [],
    executeRefund: async () => { refundInits++; return { razorpayRefundId: 'r1' }; }
  };
  const disputeStrikes: any = {
    applyDisputeStrike: async () => ({ role: 'seller', strikeNumber: 1, newTrustScore: 90 })
  };
  const { OrdersService } = require('../src/modules/orders/orders.service');
  const svc: any = new OrdersService(
    prisma,
    null,
    { createMany: async () => {} },
    paymentsService,
    { emit: () => {} },
    disputeStrikes
  );

  const results = await Promise.allSettled([
    svc.resolveDispute('d', 'REFUND_BUYER', 'admin'),
    svc.resolveDispute('d', 'REFUND_BUYER', 'admin')
  ]);
  const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
  const rejected = results.filter((r) => r.status === 'rejected').length;
  assert.equal(fulfilled, 1, 'exactly one call must succeed');
  assert.equal(rejected, 1, 'the other must reject');
  assert.equal(refundInits, 0, 'refund must not initiate (payment is null in mock)');
});

test('initiateDisputeRefund (via resolveDispute) throws when order is no longer DISPUTED/CODE_REVEALED/ESCROW_ACTIVE', async () => {
  const dispute = {
    id: 'd', orderId: 'o',
    order: {
      id: 'o', listingId: 'l',
      buyer: { id: 'b', name: 'Buyer' }, seller: { id: 's', name: 'Seller' },
      listing: { brand: { name: 'X' } }
    }
  };
  const prisma: any = {
    dispute: {
      findUnique: async () => dispute,
      updateMany: async () => ({ count: 1 })
    },
    order: { updateMany: async () => ({ count: 0 }), findUnique: async () => null }, // order already moved
    voucherListing: { updateMany: async () => ({ count: 0 }) },
    payment: { update: async () => ({}) },
    auditLog: { create: async () => ({}) },
    $transaction: async (fn: any) => fn(prisma)
  };
  const { OrdersService } = require('../src/modules/orders/orders.service');
  const svc: any = new OrdersService(
    prisma,
    null,
    { createMany: async () => {} },
    { executeRefund: async () => ({}), fetchRefundsForPayment: async () => [] },
    { emit: () => {} },
    { applyDisputeStrike: async () => ({ role: 'seller', strikeNumber: 1, newTrustScore: 90 }) }
  );
  await assert.rejects(
    () => svc.resolveDispute('d', 'REFUND_BUYER', 'admin'),
    /no longer eligible|invalid state/i
  );
});

test('orders.create rejects with friendly error when listing is no longer ACTIVE', async () => {
  const listing: any = {
    id: 'l',
    status: 'ACTIVE',
    sellingPrice: 100,
    sellerId: 's_other',
    seller: { id: 's_other', name: 'S', phone: '0000' },
    brand: { name: 'X' },
    expiryDate: new Date(Date.now() + 86400000)
  };
  const buyer: any = { id: 'b', tier: 'SILVER', name: 'B', phone: '1111' };
  const prisma: any = {
    voucherListing: { findUnique: async () => listing },
    order: { count: async () => 0, findMany: async () => [] },
    $transaction: async (fn: any) =>
      fn({
        order: {
          deleteMany: async () => ({}),
          create: async () => ({
            id: 'ord_1',
            listingId: 'l',
            buyerId: 'b',
            amount: 100,
            platformFee: 5
          })
        },
        voucherListing: { updateMany: async () => ({ count: 0 }) }, // race lost
        auditLog: { create: async () => ({}) }
      })
  };
  const { OrdersService } = require('../src/modules/orders/orders.service');
  const svc: any = new OrdersService(
    prisma,
    null,
    { createMany: async () => {} },
    { prepareCheckout: async () => ({ razorpayOrderId: 'rzp_1' }) },
    { emit: () => {} },
    null
  );
  await assert.rejects(
    () => svc.create({ listingId: 'l' }, buyer),
    /no longer available/i
  );
});

test('orders.create translates Prisma P2002 to a friendly error', async () => {
  const listing: any = {
    id: 'l',
    status: 'ACTIVE',
    sellingPrice: 100,
    sellerId: 's_other',
    seller: { id: 's_other', name: 'S', phone: '0000' },
    brand: { name: 'X' },
    expiryDate: new Date(Date.now() + 86400000)
  };
  const buyer: any = { id: 'b', tier: 'SILVER', name: 'B', phone: '1111' };
  const p2002 = new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on Order_listingId_key',
    { code: 'P2002', meta: {} }
  );
  const prisma: any = {
    voucherListing: { findUnique: async () => listing },
    order: { count: async () => 0, findMany: async () => [] },
    $transaction: async () => {
      throw p2002;
    }
  };
  const { OrdersService } = require('../src/modules/orders/orders.service');
  const svc: any = new OrdersService(
    prisma,
    null,
    { createMany: async () => {} },
    { prepareCheckout: async () => ({}) },
    { emit: () => {} },
    null
  );
  await assert.rejects(
    () => svc.create({ listingId: 'l' }, buyer),
    /no longer available/i
  );
});

test('handleRefundWebhook marks COMPLETED on processed', async () => {
  let updateArgs: any = null;
  let auditWrites: any[] = [];
  const prisma: any = {
    payment: { updateMany: async (a: any) => { updateArgs = a; return { count: 1 }; } },
    auditLog: { create: async (a: any) => { auditWrites.push(a); return {}; } }
  };
  const { OrdersService } = require('../src/modules/orders/orders.service');
  const svc: any = new OrdersService(prisma, null, { createMany: async () => {} }, null, { emit: () => {} }, null);
  await svc.handleRefundWebhook({ orderId: 'order_1' }, { id: 'rfnd_1', status: 'processed' });
  assert.equal(updateArgs.data.refundStatus, 'COMPLETED');
  assert.equal(updateArgs.data.razorpayRefundId, 'rfnd_1');
  assert.ok(auditWrites.length === 1);
  assert.equal(updateArgs.data.status, 'REFUNDED', 'payment.status must flip to REFUNDED on processed');
  assert.ok(updateArgs.data.refundCompletedAt instanceof Date, 'refundCompletedAt must be a Date');
  assert.equal(updateArgs.data.refundFailureReason, null, 'refundFailureReason must be cleared on processed');
});

test('handleRefundWebhook marks FAILED on failed', async () => {
  let updateArgs: any = null;
  const prisma: any = {
    payment: { updateMany: async (a: any) => { updateArgs = a; return { count: 1 }; } },
    auditLog: { create: async () => ({}) }
  };
  const { OrdersService } = require('../src/modules/orders/orders.service');
  const svc: any = new OrdersService(prisma, null, { createMany: async () => {} }, null, { emit: () => {} }, null);
  await svc.handleRefundWebhook({ orderId: 'order_1' }, { id: 'rfnd_x', status: 'failed', error_description: 'insufficient_funds' });
  assert.equal(updateArgs.data.refundStatus, 'FAILED');
  assert.equal(updateArgs.data.refundFailureReason, 'insufficient_funds');
});

test('handleRefundWebhook ignores when no notes.orderId', async () => {
  let updateCalled = false;
  const prisma: any = {
    payment: { updateMany: async () => { updateCalled = true; return { count: 0 }; } },
    auditLog: { create: async () => ({}) }
  };
  const { OrdersService } = require('../src/modules/orders/orders.service');
  const svc: any = new OrdersService(prisma, null, { createMany: async () => {} }, null, { emit: () => {} }, null);
  await svc.handleRefundWebhook(null, { id: 'rfnd_x', status: 'processed' });
  assert.equal(updateCalled, false);
});

test('revealCode throws when payment is not CAPTURED', async () => {
  const prisma: any = {
    order: {
      findUnique: async () => ({
        id: 'o',
        buyerId: 'b',
        status: 'ESCROW_ACTIVE',
        payment: { status: 'PENDING' },
        listing: { brand: { name: 'X' } }
      })
    }
  };
  const { OrdersService } = require('../src/modules/orders/orders.service');
  const svc: any = new OrdersService(
    prisma,
    null,
    { createMany: async () => {} },
    null,
    { emit: () => {} },
    null
  );
  await assert.rejects(
    () => svc.revealCode('o', 'b'),
    /captured|payment/i
  );
});

test('handleRefundWebhook does not downgrade an already-COMPLETED refund', async () => {
  let whereSeen: any = null;
  const prisma: any = {
    payment: {
      updateMany: async (a: any) => { whereSeen = a.where; return { count: 0 }; }
    },
    auditLog: { create: async () => ({}) }
  };
  const { OrdersService } = require('../src/modules/orders/orders.service');
  const svc: any = new OrdersService(prisma, null, { createMany: async () => {} }, null, { emit: () => {} }, null);
  await svc.handleRefundWebhook({ orderId: 'order_1' }, { id: 'rfnd_x', status: 'failed', error_description: 'late_webhook' });
  assert.ok(whereSeen?.refundStatus?.not === 'COMPLETED', 'where clause must guard against downgrading COMPLETED');
});
