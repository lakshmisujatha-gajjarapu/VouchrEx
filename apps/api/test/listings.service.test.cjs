const test = require('node:test');
const assert = require('node:assert/strict');

require('ts-node/register/transpile-only');

const { ListingsService } = require('../src/modules/listings/listings.service.ts');

test('ListingsService.create emits listing.created with full payload', async () => {
  const emitted = [];

  const prisma = {
    voucherListing: {
      count: async () => 0,
      create: async ({ data }) => ({
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
    codeVault: {
      findUnique: async () => null
    }
  };

  const codeVault = {
    hash: () => 'hash',
    encrypt: () => ({ encryptedCode: 'c', encryptionIv: 'i', encryptionTag: 't' })
  };
  const notifications = { createNotification: async () => ({}) };
  const brands = {
    resolveForListing: async () => ({ id: 'brand_1', name: 'Amazon' })
  };
  const payouts = { findByUserId: async () => ({ id: 'payout_1' }) };
  const eventEmitter = {
    emit: (eventType, payload) => {
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
    },
    { id: 'seller_1', name: 'Priya' }
  );

  const created = emitted.find((e) => e.eventType === 'listing.created');
  assert.ok(created, 'expected a listing.created emission');
  assert.equal(created.payload.listingId, 'listing_1');
  assert.equal(created.payload.sellerId, 'seller_1');
  assert.equal(created.payload.brandId, 'brand_1');
  assert.equal(created.payload.status, 'ACTIVE');
});

test('ListingsService.expire emits listing.updated with EXPIRED status', async () => {
  const emitted = [];

  const stale = [{ id: 'listing_1' }, { id: 'listing_2' }];

  const prisma = {
    voucherListing: {
      findMany: async () => stale,
      updateMany: async () => ({ count: 1 })
    }
  };

  const codeVault = {};
  const notifications = {};
  const brands = {};
  const payouts = {};
  const eventEmitter = {
    emit: (eventType, payload) => {
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
    updates.map((e) => e.payload).sort((a, b) => a.listingId.localeCompare(b.listingId)),
    [
      { listingId: 'listing_1', status: 'EXPIRED' },
      { listingId: 'listing_2', status: 'EXPIRED' }
    ]
  );
});

test('ListingsService.expire skips emit when concurrent transition makes per-id update count = 0', async () => {
  const emitted = [];
  const stale = [{ id: 'listing_1' }, { id: 'listing_2' }];

  // Simulate: listing_1 was concurrently changed (count = 0),
  // listing_2 transitions normally (count = 1).
  const prisma = {
    voucherListing: {
      findMany: async () => stale,
      updateMany: async ({ where }) => {
        if (where && where.id === 'listing_1') return { count: 0 };
        if (where && where.id === 'listing_2') return { count: 1 };
        return { count: 0 };
      }
    }
  };

  const codeVault = {};
  const notifications = {};
  const brands = {};
  const payouts = {};
  const eventEmitter = {
    emit: (eventType, payload) => {
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
