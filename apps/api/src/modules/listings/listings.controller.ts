import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';

import { sessionHeaderName } from '../auth/auth.constants';
import { AuthService } from '../auth/auth.service';
import { LISTINGS_ROUTES } from './listings.routes';
import { CreateListingDto } from './dto/create-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingsService } from './listings.service';

@ApiTags('listings')
@Controller(LISTINGS_ROUTES.BASE)
export class ListingsController {
  constructor(
    private readonly authService: AuthService,
    private readonly listingsService: ListingsService
  ) {}

  @Get()
  async findActive(
    @Query() query: QueryListingsDto,
    @Headers(sessionHeaderName) sessionToken?: string
  ) {
    const user = await this.authService.getSessionUser(sessionToken);
    return this.listingsService.findActive(query, user?.id);
  }

  @ApiHeader({
    name: sessionHeaderName,
    required: true,
    description: 'Session token returned from OTP verification.'
  })
  @Get(LISTINGS_ROUTES.SELLER_INVENTORY)
  async findMine(@Headers(sessionHeaderName) sessionToken?: string) {
    const seller = await this.authService.requireSessionUser(sessionToken);
    return this.listingsService.findMine(seller.id);
  }

  @Get(LISTINGS_ROUTES.DEAL_OF_DAY)
  getDealOfDay() {
    return this.listingsService.getDealOfDay();
  }

  @Get(LISTINGS_ROUTES.BY_ID)
  findOne(@Param('id') id: string) {
    return this.listingsService.findOne(id);
  }

  @ApiHeader({
    name: sessionHeaderName,
    required: true,
    description: 'Session token returned from OTP verification.'
  })
  @Post()
  async create(
    @Body() createListingDto: CreateListingDto,
    @Headers(sessionHeaderName) sessionToken?: string
  ) {
    const seller = await this.authService.requireSessionUser(sessionToken);
    return this.listingsService.create(createListingDto, seller);
  }

  @ApiHeader({
    name: sessionHeaderName,
    required: true,
    description: 'Session token returned from OTP verification.'
  })
  @Patch(LISTINGS_ROUTES.BY_ID)
  async update(
    @Param('id') id: string,
    @Body() updateListingDto: UpdateListingDto,
    @Headers(sessionHeaderName) sessionToken?: string
  ) {
    const seller = await this.authService.requireSessionUser(sessionToken);
    return this.listingsService.update(id, updateListingDto, seller);
  }

  @ApiHeader({
    name: sessionHeaderName,
    required: true,
    description: 'Session token returned from OTP verification.'
  })
  @Delete(LISTINGS_ROUTES.BY_ID)
  async remove(
    @Param('id') id: string,
    @Headers(sessionHeaderName) sessionToken?: string
  ) {
    const seller = await this.authService.requireSessionUser(sessionToken);
    return this.listingsService.remove(id, seller);
  }
}
