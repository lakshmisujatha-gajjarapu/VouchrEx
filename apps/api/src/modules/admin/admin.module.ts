import { Module } from '@nestjs/common';

import { PaymentsModule } from '../payments/payments.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAccessService } from './admin-access.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [PrismaModule, PaymentsModule],
  controllers: [AdminController],
  providers: [AdminAccessService],
  exports: [AdminAccessService]
})
export class AdminModule {}
