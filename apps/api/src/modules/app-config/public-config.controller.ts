import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AppConfigService } from './app-config.service';

@ApiTags('config')
@Controller('config')
export class PublicConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  /** Marketplace-wide settings the mobile/web client needs to render its UI. */
  @Get()
  async getPublicConfig() {
    return this.appConfigService.getPublicConfig();
  }
}
