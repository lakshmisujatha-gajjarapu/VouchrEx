import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { ListingsService } from './listings.service';

@Injectable()
export class ListingsScheduler {
  private readonly logger = new Logger(ListingsScheduler.name);
  private isRunning = false;

  constructor(private readonly listingsService: ListingsService) {}

  /** Every 6 hours: mark past-expiry ACTIVE listings (with no buyer) as EXPIRED. */
  @Cron('0 */6 * * *')
  async handleExpireListings() {
    if (this.isRunning) {
      this.logger.warn('handleExpireListings still running — skipping tick.');
      return;
    }
    this.isRunning = true;
    try {
      const expired = await this.listingsService.expireStaleListings();
      if (expired > 0) {
        this.logger.log(`Expired ${String(expired)} stale listing(s).`);
      }
    } catch (error) {
      this.logger.error(`handleExpireListings failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.isRunning = false;
    }
  }
}
