import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { PushModule } from '../push/push.module';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';
import { MarketingScheduler } from './marketing.scheduler';

@Module({
  imports: [AdminModule, PushModule],
  controllers: [MarketingController],
  providers: [MarketingService, MarketingScheduler],
  exports: [MarketingService]
})
export class MarketingModule {}
