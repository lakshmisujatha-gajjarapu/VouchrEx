import test from 'node:test';
import assert from 'node:assert/strict';

import { PayoutAccountsService } from '../src/modules/payouts/payout-accounts.service';

function makePrismaStub(initialAccount: any = null) {
  const state = { account: initialAccount };
  const prisma: any = {
    user: {
      findUniqueOrThrow: async () => ({ id: 'user_1', name: 'Test User', phone: '+919999999999' })
    },
    sellerPayoutAccount: {
      findUnique: async () => state.account,
      upsert: async (args: any) => {
        state.account = state.account ? { ...state.account, ...args.update } : { id: 'pa_1', ...args.create };
        return state.account;
      }
    }
  };
  return { prisma, state };
}

test('PayoutAccountsService persists UPI locally when RazorpayX is not configured', async () => {
  delete process.env.RAZORPAY_X_KEY_ID;
  delete process.env.RAZORPAY_X_KEY_SECRET;
  delete process.env.RAZORPAY_X_ACCOUNT_NUMBER;
  process.env.CODE_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';

  const { prisma } = makePrismaStub();
  let fetchCalled = false;
  const originalFetch = global.fetch;
  global.fetch = (async () => { fetchCalled = true; return { ok: true, json: async () => ({}) }; }) as any;

  const payments: any = {
    isRazorpayXEnabled: () => false,
    createRazorpayContact: async () => { throw new Error('should not be called'); },
    createRazorpayFundAccountUpi: async () => { throw new Error('should not be called'); }
  };

  const service = new PayoutAccountsService(prisma, payments);
  const account = await service.upsert('user_1', { type: 'UPI', upiId: 'tester@okicici' } as any);

  assert.equal(account.upiId, 'tester@okicici');
  assert.equal(account.razorpayContactId, null);
  assert.equal(account.razorpayFundAccountId, null);
  assert.equal(account.kycStatus, 'PENDING');
  assert.equal(fetchCalled, false);

  global.fetch = originalFetch;
});

test('PayoutAccountsService calls RazorpayX when keys are configured', async () => {
  process.env.RAZORPAY_X_KEY_ID = 'rzp_x_test';
  process.env.RAZORPAY_X_KEY_SECRET = 'secret';
  process.env.RAZORPAY_X_ACCOUNT_NUMBER = '1234567890';
  process.env.CODE_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';

  const { prisma } = makePrismaStub();
  const payments: any = {
    isRazorpayXEnabled: () => true,
    createRazorpayContact: async () => 'cont_xyz',
    createRazorpayFundAccountUpi: async () => 'fa_upi_xyz'
  };

  const service = new PayoutAccountsService(prisma, payments);
  const account = await service.upsert('user_1', { type: 'UPI', upiId: 'tester@okicici' } as any);

  assert.equal(account.razorpayContactId, 'cont_xyz');
  assert.equal(account.razorpayFundAccountId, 'fa_upi_xyz');
  assert.equal(account.kycStatus, 'VERIFIED');

  delete process.env.RAZORPAY_X_KEY_ID;
  delete process.env.RAZORPAY_X_KEY_SECRET;
  delete process.env.RAZORPAY_X_ACCOUNT_NUMBER;
});
