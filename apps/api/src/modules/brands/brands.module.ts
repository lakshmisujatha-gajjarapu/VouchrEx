import { Module } from '@nestjs/common';

import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';

@Module({
  imports: [AdminModule, AuthModule],
  controllers: [BrandsController, AlertsController],
  providers: [BrandsService, AlertsService],
  exports: [BrandsService, AlertsService]
})
export class BrandsModule {}
