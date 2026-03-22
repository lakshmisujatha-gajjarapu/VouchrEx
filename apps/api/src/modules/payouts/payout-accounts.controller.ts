import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';

import { sessionHeaderName } from '../auth/auth.constants';
import { AuthService } from '../auth/auth.service';
import {
  type UpsertPayoutAccountInput,
  UpsertPayoutAccountDto
} from './dto/upsert-payout-account.dto';
import { PayoutAccountsService } from './payout-accounts.service';

@ApiTags('payout-accounts')
@Controller('payout-accounts')
export class PayoutAccountsController {
  constructor(
    private readonly payoutAccountsService: PayoutAccountsService,
    private readonly authService: AuthService
  ) {}

  /**
   * Register or update a payout account (UPI or bank).
   * Required before a seller can receive automatic payouts.
   */
  @ApiHeader({ name: sessionHeaderName, required: true })
  @ApiOperation({ summary: 'Register or update seller payout account (UPI / bank)' })
  @Post()
  async upsert(
    @Body() dto: UpsertPayoutAccountDto,
    @Headers(sessionHeaderName) sessionToken?: string
  ) {
    const user = await this.authService.requireSessionUser(sessionToken);
    const account = await this.payoutAccountsService.upsert(user.id, dto as unknown as UpsertPayoutAccountInput);
    return {
      registered: true,
      type: account.type,
      upiId: account.upiId ?? undefined,
      accountHolderName: account.accountHolderName ?? undefined,
      verifiedAt: account.verifiedAt
    };
  }

  /**
   * Get the current user's registered payout account.
   */
  @ApiHeader({ name: sessionHeaderName, required: true })
  @ApiOperation({ summary: 'Get my registered payout account' })
  @Get('me')
  async getMyAccount(@Headers(sessionHeaderName) sessionToken?: string) {
    const user = await this.authService.requireSessionUser(sessionToken);
    const account = await this.payoutAccountsService.findByUserId(user.id);
    if (!account) {
      return { registered: false };
    }
    return {
      registered: true,
      type: account.type,
      upiId: account.upiId ?? undefined,
      accountHolderName: account.accountHolderName ?? undefined,
      verifiedAt: account.verifiedAt
    };
  }
}
