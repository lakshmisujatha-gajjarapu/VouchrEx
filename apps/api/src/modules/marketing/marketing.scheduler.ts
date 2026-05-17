import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';

@Injectable()
export class MarketingScheduler {
  private readonly logger = new Logger(MarketingScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkPromotionWindows() {
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const windows = await this.prisma.promotionWindow.findMany({
      where: { active: true, startTime: currentTime }
    });

    for (const window of windows) {
      const inventoryCount = await this.prisma.voucherListing.count({
        where: {
          status: 'ACTIVE',
          expiryDate: { gt: now },
          ...(window.category ? { brand: { category: window.category } } : {})
        }
      });

      if (inventoryCount >= window.minInventory) {
        this.logger.log(`Firing promotion push: ${window.name}`);
        
        const users = await this.prisma.user.findMany({
          where: { pushTokens: { some: {} } },
          select: { id: true }
        });

        for (const user of users) {
          // sendToUser expects SendPushPayload
          await this.pushService.sendToUser(user.id, {
            title: 'Vouchrex Deal Alert',
            body: window.pushMessage,
            link: window.category ? `/(tabs)/shop?category=${window.category}` : '/(tabs)/shop',
            eventType: 'marketing.promo',
            entityId: window.id,
            dedupeKey: `promo:${window.id}:${user.id}:${currentTime}`
          }).catch((e: unknown) => { 
            this.logger.error(`Failed to send promo push to ${user.id}: ${e instanceof Error ? e.message : String(e)}`); 
          });
        }
      }
    }
  }
}
