import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AppConfigService } from './app-config.service';
import { PublicConfigController } from './public-config.controller';

@Module({
  imports: [PrismaModule, EventEmitterModule, NotificationsModule],
  controllers: [PublicConfigController],
  providers: [AppConfigService],
  exports: [AppConfigService]
})
export class AppConfigModule {}
