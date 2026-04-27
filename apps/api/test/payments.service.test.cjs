const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');

require('ts-node/register/transpile-only');

const { PaymentsService } = require('../src/modules/payments/payments.service.ts');

test('PaymentsService prepares a checkout and stores payment record', async () => {
  const originalKeyId = process.env.RAZORPAY_KEY_ID;
  const originalKeySecret = process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_KEY_ID = 'test_key_id';
  process.env.RAZORPAY_KEY_SECRET = 'test_key_secret';

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

  // Mock fetch to avoid network calls during test
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      id: 'plink_1234567890',
      short_url: 'https://rzp.io/l/test'
    })
  });

  const service = new PaymentsService(prisma);
  const checkout = await service.prepareCheckout({
    id: 'order_1',
    listingId: 'listing_1',
    buyerId: 'buyer_1',
    amount: 420,
    platformFee: 10
  });

  assert.equal(checkout.paymentLinkId, 'plink_1234567890');
  assert.equal(checkout.paymentLinkUrl, 'https://rzp.io/l/test');
  assert.equal(upserts.length, 1);

  global.fetch = originalFetch;
  process.env.RAZORPAY_KEY_ID = originalKeyId;
  process.env.RAZORPAY_KEY_SECRET = originalKeySecret;
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
