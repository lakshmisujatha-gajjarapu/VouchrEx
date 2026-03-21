import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { BrandsModule } from './brands/brands.module';
import { HealthModule } from './health/health.module';
import { ListingsModule } from './listings/listings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env']
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'short',  ttl: 1000,   limit: 10  }, // 10 req/sec burst
        { name: 'medium', ttl: 60000,  limit: 100 }, // 100 req/min
        { name: 'long',   ttl: 900000, limit: 500 }, // 500 req/15min sustained
      ],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuthModule,
    BrandsModule,
    ListingsModule,
    OrdersModule,
    NotificationsModule,
    WebhooksModule
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
