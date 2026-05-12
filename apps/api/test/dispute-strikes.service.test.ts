import test from 'node:test';
import assert from 'node:assert/strict';

import { DisputeStrikesService } from '../src/modules/orders/dispute-strikes.service';

function makePrisma({ user, dispute }: { user: any; dispute: any }) {
  const audit: any[] = [];
  let updatedUser: any = null;
  const prisma: any = {
    dispute: {
      findUniqueOrThrow: async () => dispute
    },
    user: {
      findUniqueOrThrow: async () => user,
      update: async ({ data }: any) => {
        updatedUser = { ...user, ...data };
        return updatedUser;
      }
    },
    auditLog: {
      create: async ({ data }: any) => { audit.push(data); return data; }
    },
    $transaction: async (fn: any) => fn(prisma)
  };
  return { prisma, audit, getUpdatedUser: () => updatedUser };
}

test('seller strike 1: -15 score, payoutHold = now+7d, no suspension', async () => {
  const user = {
    id: 'seller_1', trustScore: 30, tier: 'BRONZE', status: 'ACTIVE',
    sellerStrikes: 0, buyerStrikes: 0, payoutHoldUntil: null
  };
  const dispute = {
    id: 'd1', orderId: 'o1', raisedById: 'buyer_1',
    order: { id: 'o1', buyerId: 'buyer_1', sellerId: 'seller_1' }
  };
  const { prisma, audit, getUpdatedUser } = makePrisma({ user, dispute });
  const svc = new DisputeStrikesService(prisma);

  await svc.applyDisputeStrike('d1', 'REFUND_BUYER', 'admin_1');

  const updated = getUpdatedUser();
  assert.equal(updated.sellerStrikes, 1);
  assert.equal(updated.trustScore, 15);
  assert.equal(updated.tier, 'BLOCKED');
  assert.equal(updated.status, 'ACTIVE');
  assert.ok(updated.payoutHoldUntil instanceof Date);
  const expected = Date.now() + 7 * 24 * 3600 * 1000;
  assert.ok(Math.abs(updated.payoutHoldUntil.getTime() - expected) < 5000);
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, 'seller.strike_applied');
  assert.equal(audit[0].metadata.role, 'seller');
  assert.equal(audit[0].metadata.strikeNumber, 1);
});

test('seller strike 2: extends existing hold rather than shortening', async () => {
  const future = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  const user = {
    id: 'seller_1', trustScore: 15, tier: 'BLOCKED', status: 'ACTIVE',
    sellerStrikes: 1, buyerStrikes: 0, payoutHoldUntil: future
  };
  const dispute = {
    id: 'd2', orderId: 'o2', raisedById: 'buyer_1',
    order: { id: 'o2', buyerId: 'buyer_1', sellerId: 'seller_1' }
  };
  const { prisma, getUpdatedUser } = makePrisma({ user, dispute });
  const svc = new DisputeStrikesService(prisma);

  await svc.applyDisputeStrike('d2', 'REFUND_BUYER', null);

  const updated = getUpdatedUser();
  assert.equal(updated.sellerStrikes, 2);
  assert.equal(updated.trustScore, 0);
  assert.equal(updated.payoutHoldUntil.getTime(), future.getTime());
});

test('seller strike 3: status -> SUSPENDED, hold = indefinite (year 9999)', async () => {
  const user = {
    id: 'seller_1', trustScore: 0, tier: 'BLOCKED', status: 'ACTIVE',
    sellerStrikes: 2, buyerStrikes: 0, payoutHoldUntil: new Date()
  };
  const dispute = {
    id: 'd3', orderId: 'o3', raisedById: 'buyer_1',
    order: { id: 'o3', buyerId: 'buyer_1', sellerId: 'seller_1' }
  };
  const { prisma, getUpdatedUser } = makePrisma({ user, dispute });
  const svc = new DisputeStrikesService(prisma);

  await svc.applyDisputeStrike('d3', 'REFUND_BUYER', 'admin_1');

  const updated = getUpdatedUser();
  assert.equal(updated.sellerStrikes, 3);
  assert.equal(updated.status, 'SUSPENDED');
  assert.equal(updated.payoutHoldUntil.toISOString(), '9999-12-31T23:59:59.000Z');
});

test('seller strike: score floors at 0, never negative', async () => {
  const user = {
    id: 'seller_1', trustScore: 5, tier: 'BLOCKED', status: 'ACTIVE',
    sellerStrikes: 0, buyerStrikes: 0, payoutHoldUntil: null
  };
  const dispute = {
    id: 'd4', orderId: 'o4', raisedById: 'buyer_1',
    order: { id: 'o4', buyerId: 'buyer_1', sellerId: 'seller_1' }
  };
  const { prisma, getUpdatedUser } = makePrisma({ user, dispute });
  const svc = new DisputeStrikesService(prisma);

  await svc.applyDisputeStrike('d4', 'REFUND_BUYER', null);

  assert.equal(getUpdatedUser().trustScore, 0);
});

test('buyer strike 1: -15 score, payoutHoldUntil remains null', async () => {
  const user = {
    id: 'buyer_1', trustScore: 30, tier: 'BRONZE', status: 'ACTIVE',
    sellerStrikes: 0, buyerStrikes: 0, payoutHoldUntil: null
  };
  const dispute = {
    id: 'd5', orderId: 'o5', raisedById: 'buyer_1',
    order: { id: 'o5', buyerId: 'buyer_1', sellerId: 'seller_1' }
  };
  const { prisma, audit, getUpdatedUser } = makePrisma({ user, dispute });
  const svc = new DisputeStrikesService(prisma);

  await svc.applyDisputeStrike('d5', 'RELEASE_TO_SELLER', 'admin_1');

  const updated = getUpdatedUser();
  assert.equal(updated.buyerStrikes, 1);
  assert.equal(updated.trustScore, 15);
  assert.equal(updated.status, 'ACTIVE');
  assert.equal(updated.payoutHoldUntil, null);
  assert.equal(audit[0].action, 'buyer.strike_applied');
  assert.equal(audit[0].metadata.role, 'buyer');
});

test('buyer strike 3: status -> SUSPENDED', async () => {
  const user = {
    id: 'buyer_1', trustScore: 0, tier: 'BLOCKED', status: 'ACTIVE',
    sellerStrikes: 0, buyerStrikes: 2, payoutHoldUntil: null
  };
  const dispute = {
    id: 'd6', orderId: 'o6', raisedById: 'buyer_1',
    order: { id: 'o6', buyerId: 'buyer_1', sellerId: 'seller_1' }
  };
  const { prisma, getUpdatedUser } = makePrisma({ user, dispute });
  const svc = new DisputeStrikesService(prisma);

  await svc.applyDisputeStrike('d6', 'RELEASE_TO_SELLER', 'admin_1');

  assert.equal(getUpdatedUser().status, 'SUSPENDED');
});

test('RELEASE_TO_SELLER on a seller-raised dispute -> no strike, audit logged', async () => {
  const user = {
    id: 'buyer_1', trustScore: 30, tier: 'BRONZE', status: 'ACTIVE',
    sellerStrikes: 0, buyerStrikes: 0, payoutHoldUntil: null
  };
  const dispute = {
    id: 'd7', orderId: 'o7', raisedById: 'seller_1',
    order: { id: 'o7', buyerId: 'buyer_1', sellerId: 'seller_1' }
  };
  const { prisma, audit, getUpdatedUser } = makePrisma({ user, dispute });
  const svc = new DisputeStrikesService(prisma);

  await svc.applyDisputeStrike('d7', 'RELEASE_TO_SELLER', 'admin_1');

  assert.equal(getUpdatedUser(), null);
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, 'dispute.resolved_no_strike');
});

test('REFUND_BUYER never un-suspends a SUSPENDED seller, strike count still increments', async () => {
  const user = {
    id: 'seller_1', trustScore: 0, tier: 'BLOCKED', status: 'SUSPENDED',
    sellerStrikes: 3, buyerStrikes: 0,
    payoutHoldUntil: new Date('9999-12-31T23:59:59.000Z')
  };
  const dispute = {
    id: 'd8', orderId: 'o8', raisedById: 'buyer_1',
    order: { id: 'o8', buyerId: 'buyer_1', sellerId: 'seller_1' }
  };
  const { prisma, getUpdatedUser } = makePrisma({ user, dispute });
  const svc = new DisputeStrikesService(prisma);

  await svc.applyDisputeStrike('d8', 'REFUND_BUYER', 'admin_1');

  assert.equal(getUpdatedUser().status, 'SUSPENDED');
  assert.equal(getUpdatedUser().sellerStrikes, 4);
});
