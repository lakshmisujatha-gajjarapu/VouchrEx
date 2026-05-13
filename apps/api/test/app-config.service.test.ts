import test from 'node:test';
import assert from 'node:assert/strict';

import { AppConfigService } from '../src/modules/app-config/app-config.service';

function makePrisma(initial: Record<string, { value: string; valueType?: string }> = {}) {
  const rows: Map<string, { key: string; value: string; valueType: string; description: string | null; updatedBy: string | null; updatedAt: Date }> = new Map();
  for (const [key, v] of Object.entries(initial)) {
    rows.set(key, {
      key,
      value: v.value,
      valueType: v.valueType ?? 'number',
      description: null,
      updatedBy: null,
      updatedAt: new Date()
    });
  }

  const auditWrites: any[] = [];
  let findUniqueCalls = 0;

  return {
    auditWrites,
    getFindUniqueCalls: () => findUniqueCalls,
    prisma: {
      appConfig: {
        upsert: async ({ where, create }: any) => {
          if (!rows.has(where.key)) {
            rows.set(create.key, {
              key: create.key,
              value: create.value,
              valueType: create.valueType,
              description: create.description ?? null,
              updatedBy: null,
              updatedAt: new Date()
            });
          }
          return rows.get(where.key)!;
        },
        findUnique: async ({ where }: any) => {
          findUniqueCalls++;
          return rows.get(where.key) ?? null;
        },
        findMany: async ({ where }: any = {}) => {
          const all = Array.from(rows.values());
          if (where?.key?.in) {
            const wanted = new Set<string>(where.key.in);
            return all.filter((r) => wanted.has(r.key)).sort((a, b) => a.key.localeCompare(b.key));
          }
          return all.sort((a, b) => a.key.localeCompare(b.key));
        },
        update: async ({ where, data }: any) => {
          const existing = rows.get(where.key);
          if (!existing) throw new Error('not found');
          const next = { ...existing, ...data, updatedAt: new Date() };
          rows.set(where.key, next);
          return next;
        }
      },
      auditLog: {
        create: async (args: any) => {
          auditWrites.push(args.data);
          return args.data;
        }
      },
      // Our mock methods return real promises eagerly, so $transaction just
      // resolves them in order. Real Prisma queues lazy PrismaPromise objects.
      $transaction: async (ops: any[]) => Promise.all(ops)
    } as any
  };
}

test('AppConfigService.getNumber returns parsed value from DB and caches it', async () => {
  const { prisma, getFindUniqueCalls } = makePrisma({
    buyer_fee_rate: { value: '0.07' }
  });
  const svc = new AppConfigService(
    prisma,
    { emit: () => true } as any,
    { createMany: async () => [] } as any
  );

  const first = await svc.getNumber('buyer_fee_rate', 0.10);
  const second = await svc.getNumber('buyer_fee_rate', 0.10);

  assert.equal(first, 0.07);
  assert.equal(second, 0.07);
  assert.equal(getFindUniqueCalls(), 1, 'second read must come from cache, not DB');
});

test('AppConfigService.getNumber returns fallback when key is missing', async () => {
  const { prisma } = makePrisma({});
  const svc = new AppConfigService(
    prisma,
    { emit: () => true } as any,
    { createMany: async () => [] } as any
  );

  const value = await svc.getNumber('does_not_exist', 0.42);
  assert.equal(value, 0.42);
});

test('AppConfigService.getNumber returns fallback when stored value is non-numeric', async () => {
  const { prisma } = makePrisma({
    buyer_fee_rate: { value: 'not-a-number' }
  });
  const svc = new AppConfigService(
    prisma,
    { emit: () => true } as any,
    { createMany: async () => [] } as any
  );

  const value = await svc.getNumber('buyer_fee_rate', 0.10);
  assert.equal(value, 0.10);
});

test('AppConfigService.set rejects unknown keys (defense in depth — controller exposes any key)', async () => {
  const { prisma } = makePrisma({});
  const svc = new AppConfigService(
    prisma,
    { emit: () => true } as any,
    { createMany: async () => [] } as any
  );

  await assert.rejects(() => svc.set('mystery_key', '1', null), /Unknown config key/);
});

test('AppConfigService.set rejects non-numeric value for number-typed key', async () => {
  const { prisma } = makePrisma({
    buyer_fee_rate: { value: '0.10', valueType: 'number' }
  });
  const svc = new AppConfigService(
    prisma,
    { emit: () => true } as any,
    { createMany: async () => [] } as any
  );

  await assert.rejects(() => svc.set('buyer_fee_rate', 'oops', null), /not a valid number/);
});

test('AppConfigService.set rejects values outside the per-key hard bounds (typo guard)', async () => {
  const { prisma } = makePrisma({
    buyer_fee_rate: { value: '0.10', valueType: 'number' },
    listing_max_price_inr: { value: '1000', valueType: 'number' }
  });
  const svc = new AppConfigService(
    prisma,
    { emit: () => true } as any,
    { createMany: async () => [] } as any
  );

  // Rate >1 (likely a "10" typed instead of "0.10")
  await assert.rejects(() => svc.set('buyer_fee_rate', '10', null), /out of bounds/);
  // Absurdly large INR cap
  await assert.rejects(() => svc.set('listing_max_price_inr', '999999999', null), /out of bounds/);
});

test('AppConfigService.set rejects negative numbers', async () => {
  const { prisma } = makePrisma({
    buyer_fee_rate: { value: '0.10', valueType: 'number' }
  });
  const svc = new AppConfigService(
    prisma,
    { emit: () => true } as any,
    { createMany: async () => [] } as any
  );

  await assert.rejects(() => svc.set('buyer_fee_rate', '-0.01', null), /cannot be negative/);
});

test('AppConfigService.set rejects non-boolean string for boolean-typed key', async () => {
  const { prisma } = makePrisma({
    some_flag: { value: 'true', valueType: 'boolean' }
  });
  const svc = new AppConfigService(
    prisma,
    { emit: () => true } as any,
    { createMany: async () => [] } as any
  );

  await assert.rejects(() => svc.set('some_flag', 'yes', null), /not a valid boolean/);
});

test('AppConfigService.set rejects invalid JSON for json-typed key', async () => {
  const { prisma } = makePrisma({
    some_struct: { value: '{}', valueType: 'json' }
  });
  const svc = new AppConfigService(
    prisma,
    { emit: () => true } as any,
    { createMany: async () => [] } as any
  );

  await assert.rejects(() => svc.set('some_struct', '{not-json', null), /not valid JSON/);
});

test('AppConfigService.set updates the row, invalidates local cache, writes an audit log entry, and emits config.updated', async () => {
  const { prisma, auditWrites } = makePrisma({
    buyer_fee_rate: { value: '0.10', valueType: 'number' },
    seller_commission_rate: { value: '0.10', valueType: 'number' },
    listing_max_price_inr: { value: '1000', valueType: 'number' }
  });
  const emits: { event: string; payload: unknown }[] = [];
  const svc = new AppConfigService(
    prisma,
    { emit: (event: string, payload: unknown) => { emits.push({ event, payload }); return true; } } as any,
    { createMany: async () => [] } as any
  );

  // Prime the cache
  await svc.getNumber('buyer_fee_rate', 0);
  // Update via set()
  await svc.set('buyer_fee_rate', '0.07', 'admin_1');

  // Subsequent read returns the new value (set() refreshed the cache entry)
  const v = await svc.getNumber('buyer_fee_rate', 0);
  assert.equal(v, 0.07);

  assert.equal(auditWrites.length, 1);
  assert.equal(auditWrites[0].entityType, 'app_config');
  assert.equal(auditWrites[0].entityId, 'buyer_fee_rate');
  assert.equal(auditWrites[0].action, 'config.updated');
  assert.equal(auditWrites[0].actorId, 'admin_1');
  assert.equal((auditWrites[0].metadata as any).oldValue, '0.10');
  assert.equal((auditWrites[0].metadata as any).newValue, '0.07');
  assert.equal((auditWrites[0].metadata as any).notified, false);

  // Realtime broadcast was emitted with the fresh public config payload.
  const configEmits = emits.filter((e) => e.event === 'config.updated');
  assert.equal(configEmits.length, 1, 'config.updated should be emitted exactly once');
  assert.deepEqual(configEmits[0].payload, {
    buyerFeeRate: 0.07,
    sellerCommissionRate: 0.10,
    listingMaxPriceInr: 1000
  });
});

test('AppConfigService.getPublicConfig returns whitelisted keys with fallbacks for missing rows', async () => {
  const { prisma } = makePrisma({
    buyer_fee_rate: { value: '0.05' }
    // seller_commission_rate and listing_max_price_inr deliberately absent
  });
  const svc = new AppConfigService(
    prisma,
    { emit: () => true } as any,
    { createMany: async () => [] } as any
  );

  const cfg = await svc.getPublicConfig();
  assert.equal(cfg.buyerFeeRate, 0.05);
  assert.equal(cfg.sellerCommissionRate, 0.10, 'falls back to seeded default');
  assert.equal(cfg.listingMaxPriceInr, 1000, 'falls back to seeded default');
});

test('AppConfigService.onModuleInit seeds missing default rows without overwriting existing ones', async () => {
  const { prisma } = makePrisma({
    buyer_fee_rate: { value: '0.03', valueType: 'number' } // already customized
  });
  const svc = new AppConfigService(
    prisma,
    { emit: () => true } as any,
    { createMany: async () => [] } as any
  );
  await svc.onModuleInit();

  const all = await svc.getAll();
  const buyerFeeRow = all.find((r) => r.key === 'buyer_fee_rate');
  assert.equal(buyerFeeRow?.value, '0.03', 'existing custom value must NOT be overwritten by upsert');
  assert.ok(all.find((r) => r.key === 'seller_commission_rate'), 'missing default must be seeded');
  assert.ok(all.find((r) => r.key === 'listing_max_price_inr'), 'missing default must be seeded');
});
