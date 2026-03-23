import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { BrandsModule } from './brands/brands.module';
import { HealthModule } from './health/health.module';
import { ListingsModule } from './listings/listings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { PayoutsModule } from './payouts/payouts.module';
import { RealtimeModule } from './realtime/realtime.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env']
    }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          { name: 'short',  ttl: Number(process.env.THROTTLE_SHORT_TTL_MS  ?? 1000),   limit: Number(process.env.THROTTLE_SHORT_LIMIT  ?? 10)  },
          { name: 'medium', ttl: Number(process.env.THROTTLE_MEDIUM_TTL_MS ?? 60000),  limit: Number(process.env.THROTTLE_MEDIUM_LIMIT ?? 100) },
          { name: 'long',   ttl: Number(process.env.THROTTLE_LONG_TTL_MS   ?? 900000), limit: Number(process.env.THROTTLE_LONG_LIMIT   ?? 500) },
        ],
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuthModule,
    BrandsModule,
    ListingsModule,
    OrdersModule,
    NotificationsModule,
    PayoutsModule,
    RealtimeModule,
    WebhooksModule
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
