import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ExpoPushClient } from './expo-push.client';
import { PushController } from './push.controller';
import { PushDispatcher } from './push.dispatcher';
import { PushService } from './push.service';

@Module({
  imports: [PrismaModule, AuthModule, RealtimeModule],
  controllers: [PushController],
  providers: [ExpoPushClient, PushService, PushDispatcher],
  exports: [PushService]
})
export class PushModule {}
