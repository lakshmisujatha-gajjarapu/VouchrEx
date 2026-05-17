import { Controller, Get, Post, Delete, Param, Body, Headers } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { AdminAccessService } from '../admin/admin-access.service';
import { adminHeaderName } from '../admin/admin.constants';
import { MarketingService } from './marketing.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';

@ApiTags('marketing')
@Controller('marketing')
export class MarketingController {
  constructor(
    private readonly marketingService: MarketingService,
    private readonly adminAccessService: AdminAccessService
  ) {}

  @Get('deal-availability')
  async getDealAvailability() {
    return this.marketingService.getDealAvailability();
  }

  @ApiHeader({ name: adminHeaderName, required: true })
  @Get('promotions')
  async findAllPromotions(@Headers(adminHeaderName) adminToken?: string) {
    await this.adminAccessService.requireAdminAccess(adminToken);
    return this.marketingService.findAllPromotions();
  }

  @ApiHeader({ name: adminHeaderName, required: true })
  @Post('promotions')
  async createPromotion(
    @Body() dto: CreatePromotionDto,
    @Headers(adminHeaderName) adminToken?: string
  ) {
    await this.adminAccessService.requireAdminAccess(adminToken);
    return this.marketingService.createPromotion(dto);
  }

  @ApiHeader({ name: adminHeaderName, required: true })
  @Delete('promotions/:id')
  async removePromotion(
    @Param('id') id: string,
    @Headers(adminHeaderName) adminToken?: string
  ) {
    await this.adminAccessService.requireAdminAccess(adminToken);
    return this.marketingService.removePromotion(id);
  }
}
