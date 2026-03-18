const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');

require('ts-node/register/transpile-only');

const { PaymentsService } = require('../src/modules/payments/payments.service.ts');

test('PaymentsService prepares a mock checkout without network access', async () => {
  const originalProvider = process.env.PAYMENT_PROVIDER;
  process.env.PAYMENT_PROVIDER = 'MOCK';

  const upserts = [];
  const prisma = {
    payment: {
      findUnique: async () => null,
      upsert: async (args) => {
        upserts.push(args);
        return args;
      }
    }
  };

  const service = new PaymentsService(prisma);
  const checkout = await service.prepareCheckout({
    id: 'order_1',
    listingId: 'listing_1',
    buyerId: 'buyer_1',
    amount: 420,
    platformFee: 10
  });

  assert.equal(checkout.provider, 'MOCK');
  assert.equal(checkout.orderId, 'mock_order_1');
  assert.equal(checkout.amount, 43000);
  assert.equal(upserts.length, 1);

  process.env.PAYMENT_PROVIDER = originalProvider;
});

test('PaymentsService verifies Razorpay signatures', () => {
  const originalSecret = process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_KEY_SECRET = 'test_secret';

  const service = new PaymentsService({ payment: {} });
  const signature = createHmac('sha256', 'test_secret')
    .update('order_1|pay_1')
    .digest('hex');

  assert.equal(
    service.verifySignature({
      orderId: 'order_1',
      paymentId: 'pay_1',
      signature
    }),
    true
  );
  assert.equal(
    service.verifySignature({
      orderId: 'order_1',
      paymentId: 'pay_1',
      signature: 'invalid'
    }),
    false
  );

  process.env.RAZORPAY_KEY_SECRET = originalSecret;
});
