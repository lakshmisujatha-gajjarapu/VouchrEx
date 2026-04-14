import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';

import { AdminAccessService } from '../admin/admin-access.service';
import { adminHeaderName } from '../admin/admin.constants';
import { sessionHeaderName } from '../auth/auth.constants';
import { AuthService } from '../auth/auth.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { SubmitSellerDisputeResponseDto } from './dto/submit-seller-dispute-response.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly authService: AuthService,
    private readonly adminAccessService: AdminAccessService,
    private readonly ordersService: OrdersService
  ) {}

  @ApiHeader({
    name: sessionHeaderName,
    required: true,
    description: 'Session token returned from OTP verification.'
  })
  @Get()
  async findAll(@Headers(sessionHeaderName) sessionToken?: string) {
    const user = await this.authService.requireSessionUser(sessionToken);
    return this.ordersService.findAllForUser(user.id);
  }

  @ApiHeader({
    name: sessionHeaderName,
    required: true,
    description: 'Session token returned from OTP verification.'
  })
  @Get(':id')
  async findOne(@Param('id') id: string, @Headers(sessionHeaderName) sessionToken?: string) {
    const user = await this.authService.requireSessionUser(sessionToken);
    return this.ordersService.findOneForUser(id, user.id);
  }

  @ApiHeader({
    name: sessionHeaderName,
    required: true,
    description: 'Session token returned from OTP verification.'
  })
  @Post()
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @Headers(sessionHeaderName) sessionToken?: string
  ) {
    const buyer = await this.authService.requireSessionUser(sessionToken);
    return this.ordersService.create(createOrderDto, buyer);
  }

  @ApiHeader({
    name: sessionHeaderName,
    required: true,
    description: 'Session token returned from OTP verification.'
  })
  @Post(':id/checkout')
  async prepareCheckout(
    @Param('id') id: string,
    @Headers(sessionHeaderName) sessionToken?: string
  ) {
    const buyer = await this.authService.requireSessionUser(sessionToken);
    return this.ordersService.prepareCheckout(id, buyer.id);
  }

  @ApiHeader({
    name: sessionHeaderName,
    required: true,
    description: 'Session token returned from OTP verification.'
  })
  @Post(':id/payments/verify')
  async verifyPayment(
    @Param('id') id: string,
    @Body() verifyPaymentDto: VerifyPaymentDto,
    @Headers(sessionHeaderName) sessionToken?: string
  ) {
    const buyer = await this.authService.requireSessionUser(sessionToken);
    return this.ordersService.verifyPayment(id, buyer.id, verifyPaymentDto);
  }

  @ApiHeader({
    name: sessionHeaderName,
    required: true,
    description: 'Session token returned from OTP verification.'
  })
  @Post(':id/payments/sync')
  async syncPaymentStatus(
    @Param('id') id: string,
    @Headers(sessionHeaderName) sessionToken?: string
  ) {
    const buyer = await this.authService.requireSessionUser(sessionToken);
    return this.ordersService.syncPaymentStatus(id, buyer.id);
  }

  @ApiHeader({
    name: sessionHeaderName,
    required: true,
    description: 'Session token returned from OTP verification.'
  })
  @Post(':id/reveal')
  async revealCode(@Param('id') id: string, @Headers(sessionHeaderName) sessionToken?: string) {
    const buyer = await this.authService.requireSessionUser(sessionToken);
    return this.ordersService.revealCode(id, buyer.id);
  }

  @ApiHeader({
    name: sessionHeaderName,
    required: true,
    description: 'Session token returned from OTP verification.'
  })
  @Post(':id/confirm')
  async confirm(@Param('id') id: string, @Headers(sessionHeaderName) sessionToken?: string) {
    const buyer = await this.authService.requireSessionUser(sessionToken);
    return this.ordersService.confirm(id, buyer.id);
  }

  @ApiHeader({
    name: sessionHeaderName,
    required: true,
    description: 'Session token returned from OTP verification.'
  })
  @Post(':id/disputes')
  async createDispute(
    @Param('id') id: string,
    @Body() createDisputeDto: CreateDisputeDto,
    @Headers(sessionHeaderName) sessionToken?: string
  ) {
    const buyer = await this.authService.requireSessionUser(sessionToken);
    return this.ordersService.createDispute(id, createDisputeDto, buyer.id);
  }

  @ApiHeader({
    name: sessionHeaderName,
    required: true,
    description: 'Session token of the seller who owns the disputed order.'
  })
  @Post('disputes/:id/seller-response')
  async submitSellerDisputeResponse(
    @Param('id') id: string,
    @Body() dto: SubmitSellerDisputeResponseDto,
    @Headers(sessionHeaderName) sessionToken?: string
  ) {
    const seller = await this.authService.requireSessionUser(sessionToken);
    return this.ordersService.submitSellerDisputeResponse(id, seller.id, dto.response);
  }

  @ApiHeader({
    name: adminHeaderName,
    required: true,
    description: 'Manual Phase 1 admin token for dispute resolution.'
  })
  @Post('disputes/:id/resolve')
  async resolveDispute(
    @Param('id') id: string,
    @Body() resolveDisputeDto: ResolveDisputeDto,
    @Headers(adminHeaderName) adminToken?: string
  ) {
    await this.adminAccessService.requireAdminAccess(adminToken);
    return this.ordersService.resolveDispute(id, resolveDisputeDto.resolution);
  }
}
