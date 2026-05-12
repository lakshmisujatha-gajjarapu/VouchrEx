import test from 'node:test';
import assert from 'node:assert/strict';

import { AuthService } from '../src/modules/auth/auth.service';

test('AuthService creates an OTP challenge using the provider response', async () => {
  const createdChallenges: any[] = [];
  const auditLogs: any[] = [];

  const prisma: any = {
    otpChallenge: {
      create: async ({ data }: any) => {
        createdChallenges.push(data);
        return data;
      }
    },
    user: {
      findUnique: async () => null
    },
    auditLog: {
      create: async ({ data }: any) => {
        auditLogs.push(data);
        return data;
      }
    }
  };

  const otpProviderService: any = {
    startVerification: () => ({
      provider: 'DEV',
      codeHash: 'hashed-code',
      expiresAt: new Date('2026-03-16T10:00:00.000Z'),
      debugCode: '123456'
    })
  };

  const service = new AuthService(prisma, otpProviderService);
  const response = await service.requestOtp({
    phone: '+919876543210',
    name: 'Priya'
  });

  assert.equal(response.debugCode, '123456');
  assert.equal(createdChallenges[0].provider, 'DEV');
  assert.equal(createdChallenges[0].codeHash, 'hashed-code');
  assert.equal(auditLogs[0].action, 'otp.requested');
});

test('AuthService verifies OTP and creates a session for a new user', async () => {
  const challenge = {
    id: 'otp_1',
    phone: '+919876543210',
    purpose: 'LOGIN',
    provider: 'DEV',
    providerRequestId: null,
    codeHash: 'stored-hash',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    consumedAt: null,
    attempts: 0,
    createdAt: new Date()
  };
  const txCalls: any[] = [];

  const prisma: any = {
    otpChallenge: {
      findFirst: async () => challenge,
      update: async () => ({})
    },
    user: {
      findUnique: async () => null
    },
    userSession: {},
    auditLog: {},
    $transaction: async (callback: any) =>
      callback({
        otpChallenge: {
          update: async ({ data }: any) => {
            txCalls.push(['otpChallenge.update', data]);
            return {};
          }
        },
        user: {
          upsert: async ({ create }: any) => {
            txCalls.push(['user.upsert', create]);
            return {
              id: 'user_1',
              phone: create.phone,
              name: create.name,
              email: create.email ?? null,
              status: 'ACTIVE',
              tier: 'BRONZE',
              trustScore: 30
            };
          }
        },
        userSession: {
          create: async ({ data }: any) => {
            txCalls.push(['userSession.create', data]);
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

  const otpProviderService: any = {
    verifyOtp: async () => true
  };

  const service = new AuthService(prisma, otpProviderService);
  const result = await service.verifyOtp({
    phone: '+919876543210',
    code: '123456',
    name: 'Priya'
  });

  assert.match(result.accessToken, /^[a-f0-9]{64}$/u);
  assert.match(result.refreshToken, /^[a-f0-9]{64}$/u);
  assert.equal(result.user.phone, '+919876543210');
  assert.equal(result.user.name, 'Priya');
  assert.deepEqual(
    txCalls.map(([name]) => name),
    ['otpChallenge.update', 'user.upsert', 'userSession.create', 'auditLog.create']
  );
});
