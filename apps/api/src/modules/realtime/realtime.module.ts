import { Module } from '@nestjs/common';

import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [AuthModule, AdminModule],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway]
})
export class RealtimeModule {}
