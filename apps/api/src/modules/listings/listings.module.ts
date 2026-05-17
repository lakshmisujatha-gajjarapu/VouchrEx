import { Module } from '@nestjs/common';

import { AppConfigModule } from '../app-config/app-config.module';
import { AuthModule } from '../auth/auth.module';
import { BrandsModule } from '../brands/brands.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { PushModule } from '../push/push.module';
import { ListingsController } from './listings.controller';
import { ListingsScheduler } from './listings.scheduler';
import { ListingsService } from './listings.service';
import { CodeVaultService } from './services/code-vault.service';

@Module({
  imports: [BrandsModule, AuthModule, NotificationsModule, PayoutsModule, AppConfigModule, PushModule],
  controllers: [ListingsController],
  providers: [ListingsService, CodeVaultService, ListingsScheduler],
  exports: [ListingsService, CodeVaultService]
})
export class ListingsModule {}
