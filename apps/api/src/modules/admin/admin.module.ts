import { Module } from '@nestjs/common';

import { AppConfigModule } from '../app-config/app-config.module';
import { PaymentsModule } from '../payments/payments.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAccessService } from './admin-access.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [PrismaModule, PaymentsModule, AppConfigModule],
  controllers: [AdminController],
  providers: [AdminAccessService],
  exports: [AdminAccessService]
})
export class AdminModule {}
