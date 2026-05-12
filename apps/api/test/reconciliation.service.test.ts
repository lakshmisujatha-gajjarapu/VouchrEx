import test from 'node:test';
import assert from 'node:assert/strict';

import { ReconciliationService } from '../src/modules/orders/reconciliation.service';

// Minimal stub helpers -------------------------------------------------------

function makeStuckPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay_1',
    orderId: 'order_1',
    razorpayPayoutId: 'pout_1',
    payoutStatus: 'PROCESSING',
    payoutInitiatedAt: new Date(Date.now() - 10 * 60 * 1000),
    ...overrides
  };
}

function makePrisma(payment: Record<string, unknown>, onUpdate?: (args: unknown) => void) {
  const updateCalls: unknown[] = [];
  const prisma: any = {
    payment: {
      findMany: async () => [payment],
      update: async (args: unknown) => {
        updateCalls.push(args);
        if (onUpdate) onUpdate(args);
        return {};
      }
    },
    auditLog: { create: async () => ({}) }
  };
  return { prisma, updateCalls };
}

// ----------------------------------------------------------------------------

test('reconcileStuckPayouts marks COMPLETED when Razorpay reports processed', async () => {
  let updateArgs: any = null;
  const { prisma } = makePrisma(makeStuckPayment(), (args) => { updateArgs = args; });
  const paymentsService: any = { fetchPayoutById: async () => ({ status: 'processed' }) };

  const svc = new ReconciliationService(prisma, paymentsService, null as any);
  await svc.reconcileStuckPayouts();

  assert.ok(updateArgs, 'update must have been called');
  assert.equal(updateArgs.data.payoutStatus, 'COMPLETED');
  assert.ok(updateArgs.data.payoutCompletedAt instanceof Date);
});

test('reconcileStuckPayouts marks FAILED when Razorpay reports failed', async () => {
  let updateArgs: any = null;
  const { prisma } = makePrisma(makeStuckPayment(), (args) => { updateArgs = args; });
  const paymentsService: any = {
    fetchPayoutById: async () => ({ status: 'failed', failure_reason: 'beneficiary_not_found' })
  };

  const svc = new ReconciliationService(prisma, paymentsService, null as any);
  await svc.reconcileStuckPayouts();

  assert.ok(updateArgs, 'update must have been called');
  assert.equal(updateArgs.data.payoutStatus, 'FAILED');
  assert.equal(updateArgs.data.payoutFailureReason, 'beneficiary_not_found');
});

test('reconcileStuckPayouts marks FAILED when Razorpay reports reversed (falls back to status string)', async () => {
  let updateArgs: any = null;
  const { prisma } = makePrisma(makeStuckPayment(), (args) => { updateArgs = args; });
  const paymentsService: any = {
    fetchPayoutById: async () => ({ status: 'reversed' })
  };

  const svc = new ReconciliationService(prisma, paymentsService, null as any);
  await svc.reconcileStuckPayouts();

  assert.ok(updateArgs, 'update must have been called');
  assert.equal(updateArgs.data.payoutStatus, 'FAILED');
  assert.equal(updateArgs.data.payoutFailureReason, 'reversed');
});

test('reconcileStuckPayouts leaves pending payouts alone', async () => {
  const { prisma, updateCalls } = makePrisma(makeStuckPayment());
  const paymentsService: any = { fetchPayoutById: async () => ({ status: 'pending' }) };

  const svc = new ReconciliationService(prisma, paymentsService, null as any);
  await svc.reconcileStuckPayouts();

  assert.equal(updateCalls.length, 0, 'still-pending payouts must not be touched');
});

test('reconcileStuckPayouts leaves queued payouts alone', async () => {
  const { prisma, updateCalls } = makePrisma(makeStuckPayment());
  const paymentsService: any = { fetchPayoutById: async () => ({ status: 'queued' }) };

  const svc = new ReconciliationService(prisma, paymentsService, null as any);
  await svc.reconcileStuckPayouts();

  assert.equal(updateCalls.length, 0, 'queued payouts must not be touched');
});

test('reconcileStuckPayouts continues processing remaining rows after a single row error', async () => {
  const payments = [
    makeStuckPayment({ id: 'pay_a', orderId: 'order_a', razorpayPayoutId: 'pout_a' }),
    makeStuckPayment({ id: 'pay_b', orderId: 'order_b', razorpayPayoutId: 'pout_b' })
  ];

  const updateCalls: unknown[] = [];
  const prisma: any = {
    payment: {
      findMany: async () => payments,
      update: async (args: unknown) => { updateCalls.push(args); return {}; }
    },
    auditLog: { create: async () => ({}) }
  };

  let callCount = 0;
  const paymentsService: any = {
    fetchPayoutById: async () => {
      callCount++;
      if (callCount === 1) throw new Error('network timeout');
      return { status: 'processed' };
    }
  };

  const svc = new ReconciliationService(prisma, paymentsService, null as any);
  // Must not throw even though first row errors
  await svc.reconcileStuckPayouts();

  assert.equal(updateCalls.length, 1, 'second row should still be reconciled');
  const second = updateCalls[0] as any;
  assert.equal(second.data.payoutStatus, 'COMPLETED');
});

test('reconcileStuckPayouts does nothing when no stuck payouts exist', async () => {
  let fetchCalled = false;
  const prisma: any = {
    payment: { findMany: async () => [] },
    auditLog: { create: async () => ({}) }
  };
  const paymentsService: any = {
    fetchPayoutById: async () => { fetchCalled = true; return { status: 'processed' }; }
  };

  const svc = new ReconciliationService(prisma, paymentsService, null as any);
  await svc.reconcileStuckPayouts();

  assert.equal(fetchCalled, false, 'should not call Razorpay when list is empty');
});

test('reconcileStuckRefunds skips a row already claimed by another process', async () => {
  let executeCalls = 0;
  let fetchCalls = 0;
  const prisma: any = {
    payment: {
      findMany: async () => [{
        id: 'pay_1',
        orderId: 'o',
        razorpayPaymentId: 'pay_rzp_1',
        amount: 100,
        refundStatus: 'FAILED',
        refundAttempts: 1,
        refundInitiatedAt: new Date(Date.now() - 10 * 60 * 1000)
      }],
      updateMany: async () => ({ count: 0 }),   // claim lost — someone else beat us
      update: async () => ({}),
      findUnique: async () => ({})
    },
    auditLog: { create: async () => ({}) }
  };
  const paymentsService: any = {
    fetchRefundsForPayment: async () => { fetchCalls++; return []; },
    executeRefund: async () => { executeCalls++; return { razorpayRefundId: 'r1' }; },
    fetchPayoutById: async () => ({ status: 'processed' })
  };
  const svc = new ReconciliationService(prisma, paymentsService, null as any);
  await svc.reconcileStuckRefunds();
  assert.equal(executeCalls, 0, 'must not POST refund when claim fails');
  // NOTE: fetchRefundsForPayment may or may not be called before the claim — that's
  // OK as long as no DB write or executeRefund happens. Don't assert on fetchCalls.
});

test('reconcileStuckRefunds skips FAILED rows that hit the auto-retry cap', async () => {
  let executeCalls = 0;
  const prisma: any = {
    payment: {
      findMany: async (a: any) => {
        // Assert the query includes the cap. If it doesn't, return the over-cap row
        // and let executeCalls assertion catch the bug.
        const filterAttempts = a?.where?.refundAttempts;
        if (!filterAttempts || typeof filterAttempts.lt !== 'number') {
          return [{
            orderId: 'o', razorpayPaymentId: 'pay_1', amount: 100,
            refundStatus: 'FAILED', refundAttempts: 99,
            refundInitiatedAt: new Date(Date.now() - 10 * 60 * 1000)
          }];
        }
        return [];  // cap respected → no rows returned
      },
      updateMany: async () => ({ count: 1 }),
      update: async () => ({}),
      findUnique: async () => ({})
    },
    auditLog: { create: async () => ({}) }
  };
  const paymentsService: any = {
    fetchRefundsForPayment: async () => [],
    executeRefund: async () => { executeCalls++; return { razorpayRefundId: 'r1' }; }
  };
  const { ReconciliationService: ReconciliationServiceClass } = require('../src/modules/orders/reconciliation.service');
  const svc = new ReconciliationServiceClass(prisma, paymentsService, null as any);
  await svc.reconcileStuckRefunds();
  assert.equal(executeCalls, 0, 'must skip rows beyond MAX_AUTO_REFUND_RETRY_ATTEMPTS');
});
