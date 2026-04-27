// apps/api/test/auth/msg91-widget.test.cjs
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

require('ts-node/register/transpile-only');

const { OtpProviderService } = require('../../src/modules/auth/otp-provider.service.ts');

function makeService(t) {
  const saved = {
    OTP_PROVIDER: process.env.OTP_PROVIDER,
    OTP_TTL_MINUTES: process.env.OTP_TTL_MINUTES,
    MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY,
    MSG91_WIDGET_ID: process.env.MSG91_WIDGET_ID,
  };
  process.env.OTP_PROVIDER = 'MSG91_WIDGET';
  process.env.OTP_TTL_MINUTES = '5';
  process.env.MSG91_AUTH_KEY = 'test-auth-key';
  process.env.MSG91_WIDGET_ID = 'test-widget-id';
  t.after(() => Object.assign(process.env, saved));
  return new OtpProviderService();
}

test('MSG91_WIDGET startVerification stores reqId as providerRequestId', async (t) => {
  const service = makeService(t);

  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({ type: 'success', reqId: 'req_abc123' }),
  }));

  const result = await service.startVerification('+919876543210');

  assert.equal(result.provider, 'MSG91_WIDGET');
  assert.equal(result.providerRequestId, 'req_abc123');
  assert.ok(typeof result.codeHash === 'string' && result.codeHash.length > 0, 'codeHash must be non-empty');
  assert.ok(result.expiresAt instanceof Date);
  assert.equal(result.debugCode, undefined);
});

test('MSG91_WIDGET startVerification throws when MSG91 returns error', async (t) => {
  const service = makeService(t);

  t.mock.method(globalThis, 'fetch', async () => ({
    ok: false,
    json: async () => ({ type: 'error', message: 'Invalid widget ID' }),
  }));

  await assert.rejects(
    () => service.startVerification('+919876543210'),
    { message: 'OTP delivery failed' }
  );
});

test('MSG91_WIDGET startVerification throws when MSG91 returns success but no reqId', async (t) => {
  const service = makeService(t);

  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({ type: 'success' }), // missing reqId
  }));

  await assert.rejects(
    () => service.startVerification('+919876543210'),
    { message: 'OTP delivery failed' }
  );
});

test('MSG91_WIDGET verifyOtp returns true when code is correct and phone matches', async (t) => {
  const service = makeService(t);
  let callCount = 0;

  t.mock.method(globalThis, 'fetch', async (url) => {
    callCount++;
    if (String(url).includes('verifyOtp')) {
      return { ok: true, json: async () => ({ type: 'success', 'access-token': 'jwt.test.token' }) };
    }
    // validateAccessToken — identifier without leading +
    return { ok: true, json: async () => ({ type: 'success', data: { user: { identifier: '919876543210' } } }) };
  });

  const result = await service.verifyOtp({
    phone: '+919876543210',
    provider: 'MSG91_WIDGET',
    providerRequestId: 'req_abc123',
    storedCodeHash: 'irrelevant-for-widget',
    code: '123456'
  });

  assert.equal(result, true);
  assert.equal(callCount, 2, 'must call verifyOtp then validateAccessToken');
});

test('MSG91_WIDGET verifyOtp returns false when code is wrong', async (t) => {
  const service = makeService(t);

  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({ type: 'error', message: 'OTP mismatch' }),
  }));

  const result = await service.verifyOtp({
    phone: '+919876543210',
    provider: 'MSG91_WIDGET',
    providerRequestId: 'req_abc123',
    storedCodeHash: 'irrelevant',
    code: '000000'
  });

  assert.equal(result, false);
});

test('MSG91_WIDGET verifyOtp throws BadRequestException when OTP expired', async (t) => {
  const service = makeService(t);

  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({ type: 'error', message: 'OTP expired' }),
  }));

  await assert.rejects(
    () => service.verifyOtp({
      phone: '+919876543210',
      provider: 'MSG91_WIDGET',
      providerRequestId: 'req_abc123',
      storedCodeHash: 'irrelevant',
      code: '123456'
    }),
    { message: 'OTP has expired. Request a new code.' }
  );
});

test('MSG91_WIDGET verifyOtp throws BadRequestException when retry limit hit', async (t) => {
  const service = makeService(t);

  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({ type: 'error', message: 'attempt limit exceeded' }),
  }));

  await assert.rejects(
    () => service.verifyOtp({
      phone: '+919876543210',
      provider: 'MSG91_WIDGET',
      providerRequestId: 'req_abc123',
      storedCodeHash: 'irrelevant',
      code: '123456'
    }),
    { message: 'OTP retry limit reached. Request a new code.' }
  );
});

test('MSG91_WIDGET verifyOtp returns false when validated phone does not match', async (t) => {
  const service = makeService(t);

  t.mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).includes('verifyOtp')) {
      return { ok: true, json: async () => ({ type: 'success', 'access-token': 'jwt.test.token' }) };
    }
    // returns a DIFFERENT phone
    return { ok: true, json: async () => ({ type: 'success', data: { user: { identifier: '911111111111' } } }) };
  });

  const result = await service.verifyOtp({
    phone: '+919876543210',
    provider: 'MSG91_WIDGET',
    providerRequestId: 'req_abc123',
    storedCodeHash: 'irrelevant',
    code: '123456'
  });

  assert.equal(result, false);
});

test('MSG91_WIDGET verifyOtp throws ServiceUnavailableException when providerRequestId is null', async (t) => {
  const service = makeService(t);

  await assert.rejects(
    () => service.verifyOtp({
      phone: '+919876543210',
      provider: 'MSG91_WIDGET',
      providerRequestId: null,
      storedCodeHash: 'irrelevant',
      code: '123456'
    }),
    { message: 'Missing MSG91 widget reqId for OTP challenge.' }
  );
});
