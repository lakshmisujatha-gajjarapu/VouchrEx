import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { HealthController, RootController } from './health.controller';

@Module({
  imports: [PrismaModule],
  controllers: [RootController, HealthController]
})
export class HealthModule {}
