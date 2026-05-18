import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { AdminModule } from '../admin/admin.module';
import { AppConfigModule } from '../app-config/app-config.module';
import { AuthModule } from '../auth/auth.module';
import { ListingsModule } from '../listings/listings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { PushModule } from '../push/push.module';
import { StorageModule } from '../storage/storage.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersScheduler } from './orders.scheduler';
import { ReconciliationService } from './reconciliation.service';
import { DisputeStrikesService } from './dispute-strikes.service';

@Module({
  imports: [AdminModule, AppConfigModule, ListingsModule, AuthModule, NotificationsModule, PaymentsModule, PushModule, StorageModule, EventEmitterModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersScheduler, ReconciliationService, DisputeStrikesService],
  exports: [OrdersService]
})
export class OrdersModule {}
