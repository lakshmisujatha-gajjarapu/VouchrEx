const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');

require('ts-node/register/transpile-only');

const { PaymentsService } = require('../src/modules/payments/payments.service.ts');

test('PaymentsService prepares checkout via Razorpay order and stores razorpayOrderId', async () => {
  process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
  process.env.RAZORPAY_KEY_SECRET = 'test_key_secret';

  const upserts = [];
  const prisma = {
    payment: {
      findUnique: async () => null,
      upsert: async (args) => { upserts.push(args); return args; }
    }
  };

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ id: 'order_testABC123', amount: 43000, currency: 'INR', status: 'created' })
  });

  const service = new PaymentsService(prisma);
  const checkout = await service.prepareCheckout({
    id: 'internal_order_1',
    listingId: 'listing_1',
    buyerId: 'buyer_1',
    amount: 420,
    platformFee: 10
  });

  assert.equal(checkout.razorpayOrderId, 'order_testABC123');
  assert.equal(checkout.amountPaise, 43000); // (420 + 10) * 100
  assert.equal(checkout.currency, 'INR');
  assert.equal(checkout.keyId, 'rzp_test_key');
  assert.equal(upserts[0].create.razorpayOrderId, 'order_testABC123');

  global.fetch = originalFetch;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
});

test('PaymentsService returns existing razorpayOrderId without calling Razorpay', async () => {
  process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
  process.env.RAZORPAY_KEY_SECRET = 'test_key_secret';

  let fetchCalled = false;
  const originalFetch = global.fetch;
  global.fetch = async () => { fetchCalled = true; return { ok: true, json: async () => ({}) }; };

  const prisma = {
    payment: {
      findUnique: async () => ({ razorpayOrderId: 'order_existing123' }),
      upsert: async (args) => args
    }
  };

  const service = new PaymentsService(prisma);
  const checkout = await service.prepareCheckout({
    id: 'order_1', listingId: 'l_1', buyerId: 'b_1', amount: 500, platformFee: 10
  });

  assert.equal(checkout.razorpayOrderId, 'order_existing123');
  assert.equal(fetchCalled, false);

  global.fetch = originalFetch;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
});

test('PaymentsService checkRazorpayOrderPaymentStatus returns captured payment id', async () => {
  process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
  process.env.RAZORPAY_KEY_SECRET = 'test_key_secret';

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      entity: 'collection',
      count: 1,
      items: [{ id: 'pay_captured123', status: 'captured' }]
    })
  });

  const service = new PaymentsService({ payment: {} });
  const result = await service.checkRazorpayOrderPaymentStatus('order_testABC123');

  assert.equal(result.captured, true);
  assert.equal(result.razorpayPaymentId, 'pay_captured123');

  global.fetch = originalFetch;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
});

test('PaymentsService checkRazorpayOrderPaymentStatus returns not captured when empty', async () => {
  process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
  process.env.RAZORPAY_KEY_SECRET = 'test_key_secret';

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ entity: 'collection', count: 0, items: [] })
  });

  const service = new PaymentsService({ payment: {} });
  const result = await service.checkRazorpayOrderPaymentStatus('order_testABC123');

  assert.equal(result.captured, false);
  assert.equal(result.razorpayPaymentId, undefined);

  global.fetch = originalFetch;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
});

test('PaymentsService verifies Razorpay signatures', () => {
  process.env.RAZORPAY_KEY_SECRET = 'test_secret';

  const service = new PaymentsService({ payment: {} });
  const signature = createHmac('sha256', 'test_secret').update('order_1|pay_1').digest('hex');

  assert.equal(service.verifySignature({ orderId: 'order_1', paymentId: 'pay_1', signature }), true);
  assert.equal(service.verifySignature({ orderId: 'order_1', paymentId: 'pay_1', signature: 'invalid' }), false);

  delete process.env.RAZORPAY_KEY_SECRET;
});
