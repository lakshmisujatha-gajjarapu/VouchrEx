import test from 'node:test';
import assert from 'node:assert/strict';

import { OtpProviderService } from '../../src/modules/auth/otp-provider.service';

function makeService(t: any) {
  const saved = {
    OTP_PROVIDER: process.env.OTP_PROVIDER,
    OTP_TTL_MINUTES: process.env.OTP_TTL_MINUTES,
    MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY,
  };
  process.env.OTP_PROVIDER = 'MSG91_WIDGET';
  process.env.OTP_TTL_MINUTES = '5';
  process.env.MSG91_AUTH_KEY = 'test-server-auth-key';
  t.after(() => Object.assign(process.env, saved));
  return new OtpProviderService();
}

test('MSG91_WIDGET startVerification returns placeholder without calling MSG91', async (t) => {
  const service = makeService(t);

  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('fetch must not be called during startVerification');
  });

  const result = await service.startVerification('+919876543210');

  assert.equal(result.provider, 'MSG91_WIDGET');
  assert.ok(typeof result.codeHash === 'string' && result.codeHash.length > 0, 'codeHash must be non-empty');
  assert.equal(result.providerRequestId, undefined);
  assert.equal(result.debugCode, undefined);
  assert.ok(result.expiresAt instanceof Date);
});

test('MSG91_WIDGET verifyOtp calls verifyAccessToken with JWT and returns true when phone matches', async (t) => {
  const service = makeService(t);

  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({ type: 'success', message: '919876543210' })
  } as any));

  const result = await service.verifyOtp({
    phone: '+919876543210',
    provider: 'MSG91_WIDGET',
    providerRequestId: null,
    storedCodeHash: 'irrelevant',
    code: 'eyJhbGci.eyJzdWI.signature'
  });

  assert.equal(result, true);
});

test('MSG91_WIDGET verifyOtp returns true when identifier has leading +', async (t) => {
  const service = makeService(t);

  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({ type: 'success', message: '+919876543210' })
  } as any));

  const result = await service.verifyOtp({
    phone: '+919876543210',
    provider: 'MSG91_WIDGET',
    providerRequestId: null,
    storedCodeHash: 'irrelevant',
    code: 'eyJhbGci.eyJzdWI.signature'
  });

  assert.equal(result, true);
});

test('MSG91_WIDGET verifyOtp returns false when phone does not match', async (t) => {
  const service = makeService(t);

  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({ type: 'success', message: '911111111111' })
  } as any));

  const result = await service.verifyOtp({
    phone: '+919876543210',
    provider: 'MSG91_WIDGET',
    providerRequestId: null,
    storedCodeHash: 'irrelevant',
    code: 'eyJhbGci.eyJzdWI.signature'
  });

  assert.equal(result, false);
});

test('MSG91_WIDGET verifyOtp throws ServiceUnavailableException when MSG91 returns error', async (t) => {
  const service = makeService(t);

  t.mock.method(globalThis, 'fetch', async () => ({
    ok: false,
    status: 200,
    json: async () => ({ type: 'error', message: 'Invalid token' })
  } as any));

  await assert.rejects(
    () => service.verifyOtp({
      phone: '+919876543210',
      provider: 'MSG91_WIDGET',
      providerRequestId: null,
      storedCodeHash: 'irrelevant',
      code: 'bad.token.here'
    }),
    { message: 'Failed to validate MSG91 OTP token.' }
  );
});

test('MSG91_WIDGET verifyOtp throws ServiceUnavailableException when MSG91_AUTH_KEY missing', async (t) => {
  const saved = process.env.MSG91_AUTH_KEY;
  process.env.OTP_PROVIDER = 'MSG91_WIDGET';
  process.env.MSG91_AUTH_KEY = '';
  t.after(() => { process.env.MSG91_AUTH_KEY = saved; });

  const service = new OtpProviderService();

  await assert.rejects(
    () => service.verifyOtp({
      phone: '+919876543210',
      provider: 'MSG91_WIDGET',
      providerRequestId: null,
      storedCodeHash: 'irrelevant',
      code: 'eyJhbGci.eyJzdWI.signature'
    }),
    { message: 'MSG91_AUTH_KEY is not configured.' }
  );
});
