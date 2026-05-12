import test from 'node:test';
import assert from 'node:assert/strict';

import { OtpProviderService } from '../src/modules/auth/otp-provider.service';

test('OtpProviderService uses a fixed dev OTP', async () => {
  const originalProvider = process.env.OTP_PROVIDER;
  const originalCode = process.env.OTP_FIXED_CODE;
  const originalTtl = process.env.OTP_TTL_MINUTES;

  process.env.OTP_PROVIDER = 'DEV';
  process.env.OTP_FIXED_CODE = '123456';
  process.env.OTP_TTL_MINUTES = '5';

  const service = new OtpProviderService();
  const challenge = await service.startVerification('+919876543210');

  assert.equal(challenge.provider, 'DEV');
  assert.equal(challenge.debugCode, '123456');
  assert.ok(challenge.expiresAt instanceof Date);

  const valid = await service.verifyOtp({
    phone: '+919876543210',
    provider: 'DEV',
    providerRequestId: null,
    storedCodeHash: challenge.codeHash,
    code: '123456'
  });
  const invalid = await service.verifyOtp({
    phone: '+919876543210',
    provider: 'DEV',
    providerRequestId: null,
    storedCodeHash: challenge.codeHash,
    code: '000000'
  });

  assert.equal(valid, true);
  assert.equal(invalid, false);

  process.env.OTP_PROVIDER = originalProvider;
  process.env.OTP_FIXED_CODE = originalCode;
  process.env.OTP_TTL_MINUTES = originalTtl;
});
