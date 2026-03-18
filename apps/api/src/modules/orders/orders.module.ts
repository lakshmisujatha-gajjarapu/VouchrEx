import { Module } from '@nestjs/common';

import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { ListingsModule } from '../listings/listings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersScheduler } from './orders.scheduler';
import { ReconciliationService } from './reconciliation.service';

@Module({
  imports: [AdminModule, ListingsModule, AuthModule, NotificationsModule, PaymentsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersScheduler, ReconciliationService],
  exports: [OrdersService]
})
export class OrdersModule {}
