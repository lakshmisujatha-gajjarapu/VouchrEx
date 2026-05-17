import { Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiHeader, ApiQuery, ApiTags } from '@nestjs/swagger';

import { AdminAccessService } from '../admin/admin-access.service';
import { adminHeaderName } from '../admin/admin.constants';
import { BrandsService } from './brands.service';
import { BRANDS_ROUTES } from './brands.routes';

@ApiTags('brands')
@Controller(BRANDS_ROUTES.BASE)
export class BrandsController {
  constructor(
    private readonly brandsService: BrandsService,
    private readonly adminAccessService: AdminAccessService
  ) {}

  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Optional local brand search query.'
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Optional result cap for local suggestions.'
  })
  @Get()
  findAll(@Query('q') q?: string, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : undefined;
    const safeLimit =
      typeof parsedLimit === 'number' && Number.isFinite(parsedLimit)
        ? parsedLimit
        : null;
    const input: {
      q?: string;
      limit?: number;
    } = {};

    if (q) {
      input.q = q;
    }

    if (safeLimit !== null) {
      input.limit = safeLimit;
    }

    return this.brandsService.findAll(input);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.brandsService.findOne(id);
  }

  @ApiHeader({
    name: adminHeaderName,
    required: true,
    description: 'Manual Phase 1 admin token for catalog bootstrap.'
  })
  @Post(BRANDS_ROUTES.SEED)
  async seedDefaults(@Headers(adminHeaderName) adminToken?: string) {
    await this.adminAccessService.requireAdminAccess(adminToken);
    return this.brandsService.seedDefaults();
  }
}
