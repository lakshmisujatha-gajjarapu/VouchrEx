import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isQuietHoursIST(): boolean {
  const istTime = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    hour12: false
  });
  const hour = parseInt(istTime.slice(0, 2), 10);
  return hour >= 22 || hour < 8;
}

type DiscountTier = 'Weak' | 'Fair' | 'Good' | 'Hot';

function discountTier(discountPct: number): DiscountTier {
  if (discountPct < 8) return 'Weak';
  if (discountPct < 15) return 'Fair';
  if (discountPct < 25) return 'Good';
  return 'Hot';
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

@Injectable()
export class SellerNudgeScheduler {
  private readonly logger = new Logger(SellerNudgeScheduler.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService
  ) {}

  @Cron('0 * * * *')
  async handleSellerNudges(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('handleSellerNudges still running — skipping tick.');
      return;
    }

    if (isQuietHoursIST()) {
      this.logger.debug('Quiet hours (IST) — skipping seller nudge tick.');
      return;
    }

    this.isRunning = true;
    try {
      await this.fireHealth24Nudges();
      await this.fireHealth48Nudges();
      await this.fireExpiry7dNudges();
      await this.fireExpiry3dNudges();
      await this.fireExpiry24hNudges();
      await this.fireExpirydayNudges();
      await this.fireExpiredRecoveryNudges();
    } catch (error) {
      this.logger.error(
        `handleSellerNudges failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      this.isRunning = false;
    }
  }

  // -------------------------------------------------------------------------
  // Health nudge T+24h
  // -------------------------------------------------------------------------

  private async fireHealth24Nudges(): Promise<void> {
    const now = new Date();
    const from = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25h ago
    const to = new Date(now.getTime() - 23 * 60 * 60 * 1000);   // 23h ago

    const listings = await this.findActiveListingsCreatedBetween(from, to);

    for (const listing of listings) {
      if (listing.sellingPrice > listing.faceValue) {
        this.logger.warn(`Listing ${listing.id} has sellingPrice > faceValue — skipping nudge`);
        continue;
      }

      const discount = Math.round((1 - listing.sellingPrice / listing.faceValue) * 100);
      const tier = discountTier(discount);

      let body: string;
      if (tier === 'Weak') {
        const suggested = discount + 7;
        body = `Your ${listing.brand.name} voucher hasn't sold yet — at ${String(discount)}% off, buyers may scroll past it. Try dropping to ${String(suggested)}% off. [View listing →]`;
      } else if (tier === 'Fair') {
        const suggested = discount + 5;
        body = `Your ${listing.brand.name} voucher hasn't sold yet. You're close — dropping to ${String(suggested)}% off could close a sale today. [View listing →]`;
      } else {
        body = `Your ${listing.brand.name} voucher is priced well. Buyers typically see listings at 15%+ off sell within 48 hours — hang tight. [View listing →]`;
      }

      await this.send(listing.sellerId, {
        title: `Your ${listing.brand.name} voucher hasn't sold yet`,
        body,
        link: `/listings/${listing.id}`,
        dedupeKey: `seller-nudge:health24:${listing.id}`,
        entityId: listing.id
      });
    }
  }

  // -------------------------------------------------------------------------
  // Reprice nudge T+48h (Weak/Fair only)
  // -------------------------------------------------------------------------

  private async fireHealth48Nudges(): Promise<void> {
    const now = new Date();
    const from = new Date(now.getTime() - 49 * 60 * 60 * 1000); // 49h ago
    const to = new Date(now.getTime() - 47 * 60 * 60 * 1000);   // 47h ago

    const listings = await this.findActiveListingsCreatedBetween(from, to);

    for (const listing of listings) {
      if (listing.sellingPrice > listing.faceValue) {
        this.logger.warn(`Listing ${listing.id} has sellingPrice > faceValue — skipping nudge`);
        continue;
      }

      const discount = Math.round((1 - listing.sellingPrice / listing.faceValue) * 100);
      const tier = discountTier(discount);

      // Only fire for Weak or Fair
      if (tier === 'Good' || tier === 'Hot') continue;

      const suggestedDiscount = tier === 'Weak' ? discount + 7 : discount + 5;
      const suggestedPrice = Math.floor(listing.faceValue * (1 - suggestedDiscount / 100));

      await this.send(listing.sellerId, {
        title: `${listing.brand.name} voucher still available — time to reprice`,
        body: `It's been 2 days. Drop to ₹${String(suggestedPrice)} (${String(suggestedDiscount)}% off) and it'll likely sell today. [Reprice →]`,
        link: `/listings/${listing.id}`,
        dedupeKey: `seller-nudge:health48:${listing.id}`,
        entityId: listing.id
      });
    }
  }

  // -------------------------------------------------------------------------
  // Expiry countdown — 7 days before expiry
  // -------------------------------------------------------------------------

  private async fireExpiry7dNudges(): Promise<void> {
    const now = new Date();
    // 4h window around 7-day mark: expiryDate is 6d 22h to 7d 2h from now
    const windowFrom = new Date(now.getTime() + (7 * 24 - 2) * 60 * 60 * 1000); // 6d 22h
    const windowTo = new Date(now.getTime() + (7 * 24 + 2) * 60 * 60 * 1000);   // 7d 2h

    const listings = await this.findActiveListingsExpiringBetween(windowFrom, windowTo);

    for (const listing of listings) {
      if (listing.sellingPrice > listing.faceValue) {
        this.logger.warn(`Listing ${listing.id} has sellingPrice > faceValue — skipping nudge`);
        continue;
      }

      const discount = Math.round((1 - listing.sellingPrice / listing.faceValue) * 100);
      const tier = discountTier(discount);

      let body: string;
      if (tier === 'Good' || tier === 'Hot') {
        body = `At current price, you have time — but don't wait too long. [Check listing →]`;
      } else {
        const suggested = tier === 'Weak' ? discount + 7 : discount + 5;
        body = `At current price (${String(discount)}% off), average sell time is longer than 7 days — price at ${String(suggested)}% off to sell before expiry. [Reprice →]`;
      }

      await this.send(listing.sellerId, {
        title: `${listing.brand.name} voucher expires in 7 days`,
        body,
        link: `/listings/${listing.id}`,
        dedupeKey: `seller-nudge:expiry7d:${listing.id}`,
        entityId: listing.id
      });
    }
  }

  // -------------------------------------------------------------------------
  // Expiry countdown — 3 days before expiry
  // -------------------------------------------------------------------------

  private async fireExpiry3dNudges(): Promise<void> {
    const now = new Date();
    const windowFrom = new Date(now.getTime() + (3 * 24 - 2) * 60 * 60 * 1000); // 2d 22h
    const windowTo = new Date(now.getTime() + (3 * 24 + 2) * 60 * 60 * 1000);   // 3d 2h

    const listings = await this.findActiveListingsExpiringBetween(windowFrom, windowTo);

    for (const listing of listings) {
      const suggestedPrice = Math.floor(listing.sellingPrice * 0.95);

      await this.send(listing.sellerId, {
        title: `3 days left on your ${listing.brand.name} voucher ⚠️`,
        body: `Drop to ₹${String(suggestedPrice)} and sell before it expires worthless. [Reprice now →]`,
        link: `/listings/${listing.id}`,
        dedupeKey: `seller-nudge:expiry3d:${listing.id}`,
        entityId: listing.id
      });
    }
  }

  // -------------------------------------------------------------------------
  // Expiry countdown — 24 hours before expiry
  // -------------------------------------------------------------------------

  private async fireExpiry24hNudges(): Promise<void> {
    const now = new Date();
    const windowFrom = new Date(now.getTime() + 22 * 60 * 60 * 1000); // 22h from now
    const windowTo = new Date(now.getTime() + 26 * 60 * 60 * 1000);   // 26h from now

    const listings = await this.findActiveListingsExpiringBetween(windowFrom, windowTo);

    for (const listing of listings) {
      const floor = Math.floor(listing.faceValue * 0.80);

      await this.send(listing.sellerId, {
        title: `Your ${listing.brand.name} voucher expires TOMORROW`,
        body: `You could still get ₹${String(listing.sellingPrice)} tonight. Even ₹${String(floor)} (face value × 0.80) is better than nothing. [Reprice →]`,
        link: `/listings/${listing.id}`,
        dedupeKey: `seller-nudge:expiry24h:${listing.id}`,
        entityId: listing.id
      });
    }
  }

  // -------------------------------------------------------------------------
  // Expiry day — day of expiry
  // -------------------------------------------------------------------------

  private async fireExpirydayNudges(): Promise<void> {
    const now = new Date();
    // expiryDate falls within today: 0h to 24h from now
    const windowFrom = now;
    const windowTo = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const listings = await this.findActiveListingsExpiringBetween(windowFrom, windowTo);

    for (const listing of listings) {
      const floor = Math.floor(listing.faceValue * 0.75);
      const savings = listing.faceValue - floor;

      await this.send(listing.sellerId, {
        title: `Last chance — ${listing.brand.name} voucher expires today`,
        body: `Get ₹${String(floor)} before midnight. That's still ₹${String(savings)} in your pocket. [Reprice now →]`,
        link: `/listings/${listing.id}`,
        dedupeKey: `seller-nudge:expiryday:${listing.id}`,
        entityId: listing.id
      });
    }
  }

  // -------------------------------------------------------------------------
  // Expired recovery push
  // -------------------------------------------------------------------------

  private async fireExpiredRecoveryNudges(): Promise<void> {
    const now = new Date();
    // Listings that expired in the last 6 hours
    const from = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    const listings = await this.prisma.voucherListing.findMany({
      where: {
        status: 'EXPIRED',
        expiryDate: { gte: from, lt: now },
        order: null
      },
      select: {
        id: true,
        createdAt: true,
        expiryDate: true,
        sellingPrice: true,
        faceValue: true,
        sellerId: true,
        brand: {
          select: {
            name: true,
            avgDiscountPercent: true
          }
        }
      }
    });

    for (const listing of listings) {
      const suggestedDiscount = listing.brand.avgDiscountPercent + 2;

      await this.send(listing.sellerId, {
        title: `Your ${listing.brand.name} voucher expired unsold`,
        body: `It happens. List your next voucher at ${String(suggestedDiscount)}% off from the start — that's the sweet spot for fast sales. [List another →]`,
        link: `/(tabs)/sell`,
        dedupeKey: `seller-nudge:expired:${listing.id}`,
        entityId: listing.id
      });
    }
  }

  // -------------------------------------------------------------------------
  // Shared query helpers
  // -------------------------------------------------------------------------

  private findActiveListingsCreatedBetween(
    from: Date,
    to: Date
  ) {
    return this.prisma.voucherListing.findMany({
      where: {
        status: 'ACTIVE',
        createdAt: { gte: from, lte: to },
        order: null
      },
      select: {
        id: true,
        createdAt: true,
        expiryDate: true,
        sellingPrice: true,
        faceValue: true,
        sellerId: true,
        brand: {
          select: {
            name: true,
            avgDiscountPercent: true
          }
        }
      }
    });
  }

  private findActiveListingsExpiringBetween(
    from: Date,
    to: Date
  ) {
    return this.prisma.voucherListing.findMany({
      where: {
        status: 'ACTIVE',
        expiryDate: { gte: from, lte: to },
        order: null
      },
      select: {
        id: true,
        createdAt: true,
        expiryDate: true,
        sellingPrice: true,
        faceValue: true,
        sellerId: true,
        brand: {
          select: {
            name: true,
            avgDiscountPercent: true
          }
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // Push helper
  // -------------------------------------------------------------------------

  private async send(
    userId: string,
    payload: {
      readonly title: string;
      readonly body: string;
      readonly link: string;
      readonly dedupeKey: string;
      readonly entityId: string;
    }
  ): Promise<void> {
    await this.pushService
      .sendToUser(userId, {
        title: payload.title,
        body: payload.body,
        link: payload.link,
        eventType: 'seller.nudge',
        entityId: payload.entityId,
        dedupeKey: payload.dedupeKey
      })
      .catch((e: unknown) => {
        this.logger.error(
          `Failed to send seller nudge to ${userId} (dedupeKey=${payload.dedupeKey}): ${e instanceof Error ? e.message : String(e)}`
        );
      });
  }
}
