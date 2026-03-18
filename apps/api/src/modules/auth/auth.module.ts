import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthScheduler } from './auth.scheduler';
import { AuthService } from './auth.service';
import { OtpProviderService } from './otp-provider.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, OtpProviderService, AuthScheduler],
  exports: [AuthService]
})
export class AuthModule {}
