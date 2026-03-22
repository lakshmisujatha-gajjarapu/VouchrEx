import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PayoutAccountsController } from './payout-accounts.controller';
import { PayoutAccountsService } from './payout-accounts.service';

@Module({
  imports: [PrismaModule, PaymentsModule, AuthModule],
  controllers: [PayoutAccountsController],
  providers: [PayoutAccountsService],
  exports: [PayoutAccountsService]
})
export class PayoutsModule {}
