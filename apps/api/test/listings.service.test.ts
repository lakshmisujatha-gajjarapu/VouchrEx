import test from 'node:test';
import assert from 'node:assert/strict';

import { ListingsService } from '../src/modules/listings/listings.service';

test('ListingsService.create emits listing.created with full payload', async () => {
  const emitted: any[] = [];

  const prisma: any = {
    voucherListing: {
      count: async () => 0,
      create: async ({ data }: any) => ({
        id: 'listing_1',
        sellerId: data.sellerId,
        brandId: data.brandId,
        status: 'ACTIVE',
        sellingPrice: data.sellingPrice,
        faceValue: data.faceValue,
        discountPercent: data.discountPercent,
        expiryDate: data.expiryDate,
        brand: { id: data.brandId, name: 'Amazon' },
        seller: { id: data.sellerId, name: 'Priya' }
      })
    },
    user: {
      findUnique: async () => ({ trustScore: 100 })
    },
    codeVault: {
      findUnique: async () => null
    }
  };

  const codeVault: any = {
    hash: () => 'hash',
    encrypt: () => ({ encryptedCode: 'c', encryptionIv: 'i', encryptionTag: 't' })
  };
  const notifications: any = { createNotification: async () => ({}) };
  const brands: any = {
    resolveForListing: async () => ({ id: 'brand_1', name: 'Amazon' })
  };
  const payouts: any = { findByUserId: async () => ({ id: 'payout_1' }) };
  const eventEmitter: any = {
    emit: (eventType: string, payload: unknown) => {
      emitted.push({ eventType, payload });
      return true;
    }
  };

  const service = new ListingsService(prisma, codeVault, notifications, brands, payouts, eventEmitter);

  await service.create(
    {
      brandName: 'Amazon',
      voucherType: 'GIFT_CARD',
      faceValue: 500,
      sellingPrice: 450,
      code: 'AMZ123',
      expiryDate: new Date(Date.now() + 30 * 86_400_000).toISOString()
    } as any,
    { id: 'seller_1', name: 'Priya' } as any
  );

  const created = emitted.find((e) => e.eventType === 'listing.created');
  assert.ok(created, 'expected a listing.created emission');
  assert.equal(created.payload.listingId, 'listing_1');
  assert.equal(created.payload.sellerId, 'seller_1');
  assert.equal(created.payload.brandId, 'brand_1');
  assert.equal(created.payload.status, 'ACTIVE');
});

test('ListingsService.expire emits listing.updated with EXPIRED status', async () => {
  const emitted: any[] = [];

  const stale = [{ id: 'listing_1' }, { id: 'listing_2' }];

  const prisma: any = {
    voucherListing: {
      findMany: async () => stale,
      updateMany: async () => ({ count: 1 })
    }
  };

  const codeVault: any = {};
  const notifications: any = {};
  const brands: any = {};
  const payouts: any = {};
  const eventEmitter: any = {
    emit: (eventType: string, payload: unknown) => {
      emitted.push({ eventType, payload });
      return true;
    }
  };

  const service = new ListingsService(prisma, codeVault, notifications, brands, payouts, eventEmitter);

  const count = await service.expireStaleListings();

  assert.equal(count, 2);
  const updates = emitted.filter((e) => e.eventType === 'listing.updated');
  assert.equal(updates.length, 2, 'expected one listing.updated per expired listing');
  assert.deepEqual(
    updates.map((e) => e.payload).sort((a: any, b: any) => a.listingId.localeCompare(b.listingId)),
    [
      { listingId: 'listing_1', status: 'EXPIRED' },
      { listingId: 'listing_2', status: 'EXPIRED' }
    ]
  );
});

test('ListingsService.expire skips emit when concurrent transition makes per-id update count = 0', async () => {
  const emitted: any[] = [];
  const stale = [{ id: 'listing_1' }, { id: 'listing_2' }];

  const prisma: any = {
    voucherListing: {
      findMany: async () => stale,
      updateMany: async ({ where }: any) => {
        if (where && where.id === 'listing_1') return { count: 0 };
        if (where && where.id === 'listing_2') return { count: 1 };
        return { count: 0 };
      }
    }
  };

  const codeVault: any = {};
  const notifications: any = {};
  const brands: any = {};
  const payouts: any = {};
  const eventEmitter: any = {
    emit: (eventType: string, payload: unknown) => {
      emitted.push({ eventType, payload });
      return true;
    }
  };

  const service = new ListingsService(prisma, codeVault, notifications, brands, payouts, eventEmitter);

  const count = await service.expireStaleListings();

  assert.equal(count, 1, 'only one listing actually transitioned');
  const updates = emitted.filter((e) => e.eventType === 'listing.updated');
  assert.equal(updates.length, 1, 'expected exactly one listing.updated emit');
  assert.deepEqual(updates[0].payload, { listingId: 'listing_2', status: 'EXPIRED' });
});

function makeCapServiceMocks() {
  const prisma: any = {
    voucherListing: {
      count: async () => 0,
      create: async ({ data }: any) => ({
        id: 'listing_1',
        sellerId: data.sellerId,
        brandId: data.brandId,
        status: 'ACTIVE',
        sellingPrice: data.sellingPrice,
        faceValue: data.faceValue,
        discountPercent: data.discountPercent,
        expiryDate: data.expiryDate,
        brand: { id: data.brandId, name: 'Amazon' },
        seller: { id: data.sellerId, name: 'Priya' }
      })
    },
    user: { findUnique: async () => ({ trustScore: 100 }) },
    codeVault: { findUnique: async () => null }
  };
  const codeVault: any = {
    hash: () => 'hash',
    encrypt: () => ({ encryptedCode: 'c', encryptionIv: 'i', encryptionTag: 't' })
  };
  const notifications: any = { createNotification: async () => ({}) };
  const brands: any = { resolveForListing: async () => ({ id: 'brand_1', name: 'Amazon' }) };
  const payouts: any = { findByUserId: async () => ({ id: 'payout_1' }) };
  const eventEmitter: any = { emit: () => true };
  return new ListingsService(prisma, codeVault, notifications, brands, payouts, eventEmitter);
}

test('ListingsService.create rejects when faceValue exceeds the ₹1,000 cap', async () => {
  const service = makeCapServiceMocks();
  await assert.rejects(
    () =>
      service.create(
        {
          brandName: 'Amazon',
          voucherType: 'GIFT_CARD',
          faceValue: 1500,
          sellingPrice: 800,
          code: 'AMZ123',
          expiryDate: new Date(Date.now() + 30 * 86_400_000).toISOString()
        } as any,
        { id: 'seller_1', name: 'Priya' } as any
      ),
    /face value/i
  );
});

test('ListingsService.create accepts faceValue at the cap with sellingPrice below it', async () => {
  const service = makeCapServiceMocks();
  const result = await service.create(
    {
      brandName: 'Amazon',
      voucherType: 'GIFT_CARD',
      faceValue: 1000,
      sellingPrice: 900,
      code: 'AMZ123',
      expiryDate: new Date(Date.now() + 30 * 86_400_000).toISOString()
    } as any,
    { id: 'seller_1', name: 'Priya' } as any
  );
  assert.equal(result.faceValue, 1000);
  assert.equal(result.sellingPrice, 900);
});

test('ListingsService.create rejects when sellingPrice >= faceValue', async () => {
  const service = makeCapServiceMocks();
  await assert.rejects(
    () =>
      service.create(
        {
          brandName: 'Amazon',
          voucherType: 'GIFT_CARD',
          faceValue: 500,
          sellingPrice: 600,
          code: 'AMZ123',
          expiryDate: new Date(Date.now() + 30 * 86_400_000).toISOString()
        } as any,
        { id: 'seller_1', name: 'Priya' } as any
      ),
    /below face value/i
  );
});

test('ListingsService.remove rejects when listing has an active order', async () => {
  const prisma: any = {
    voucherListing: {
      findUnique: async () => ({
        id: 'listing_1',
        sellerId: 'seller_1',
        status: 'ACTIVE',
        brand: { id: 'brand_1' },
        order: null,
        codeVault: {}
      }),
      delete: async () => {
        throw new Error('must not be called');
      }
    },
    order: {
      count: async () => 1
    }
  };

  const codeVault: any = {};
  const notifications: any = {};
  const brands: any = {};
  const payouts: any = {};
  const eventEmitter: any = {};

  const service = new ListingsService(prisma, codeVault, notifications, brands, payouts, eventEmitter);

  await assert.rejects(
    () => service.remove('listing_1', { id: 'seller_1' }),
    /active order/i
  );
});
