import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import {
  THROTTLE_LONG_LIMIT_DEFAULT,
  THROTTLE_LONG_TTL_MS_DEFAULT,
  THROTTLE_MEDIUM_LIMIT_DEFAULT,
  THROTTLE_MEDIUM_TTL_MS_DEFAULT,
  THROTTLE_SHORT_LIMIT_DEFAULT,
  THROTTLE_SHORT_TTL_MS_DEFAULT
} from '../common/throttle.constants';
import { AdminModule } from './admin/admin.module';
import { AppConfigModule } from './app-config/app-config.module';
import { AuthModule } from './auth/auth.module';
import { BrandsModule } from './brands/brands.module';
import { HealthModule } from './health/health.module';
import { ListingsModule } from './listings/listings.module';
import { MarketingModule } from './marketing/marketing.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { PayoutsModule } from './payouts/payouts.module';
import { PushModule } from './push/push.module';
import { RealtimeModule } from './realtime/realtime.module';
import { UsersModule } from './users/users.module';
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
        skipIf: () => process.env.NODE_ENV !== 'production',
        throttlers: [
          { name: 'short',  ttl: Number(process.env.THROTTLE_SHORT_TTL_MS  ?? THROTTLE_SHORT_TTL_MS_DEFAULT),  limit: Number(process.env.THROTTLE_SHORT_LIMIT  ?? THROTTLE_SHORT_LIMIT_DEFAULT)  },
          { name: 'medium', ttl: Number(process.env.THROTTLE_MEDIUM_TTL_MS ?? THROTTLE_MEDIUM_TTL_MS_DEFAULT), limit: Number(process.env.THROTTLE_MEDIUM_LIMIT ?? THROTTLE_MEDIUM_LIMIT_DEFAULT) },
          { name: 'long',   ttl: Number(process.env.THROTTLE_LONG_TTL_MS   ?? THROTTLE_LONG_TTL_MS_DEFAULT),   limit: Number(process.env.THROTTLE_LONG_LIMIT   ?? THROTTLE_LONG_LIMIT_DEFAULT) },
        ],
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuthModule,
    AdminModule,
    AppConfigModule,
    BrandsModule,
    ListingsModule,
    MarketingModule,
    OrdersModule,
    NotificationsModule,
    PayoutsModule,
    PushModule,
    RealtimeModule,
    UsersModule,
    WebhooksModule
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
