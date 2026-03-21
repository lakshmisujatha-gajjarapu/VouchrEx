import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { sessionHeaderName } from './auth.constants';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Tight limit: 1 OTP request per 10s, 5 per minute to deter brute force / SMS flooding
  @Throttle({ short: { limit: 1, ttl: 10000 }, medium: { limit: 5, ttl: 60000 } })
  @Post('otp/request')
  requestOtp(@Body() requestOtpDto: RequestOtpDto) {
    return this.authService.requestOtp(requestOtpDto);
  }

  // 5 verify attempts per minute per IP (service-layer also limits per phone)
  @Throttle({ short: { limit: 1, ttl: 2000 }, medium: { limit: 5, ttl: 60000 } })
  @Post('otp/verify')
  verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @ApiHeader({
    name: sessionHeaderName,
    required: true,
    description: 'Session token returned from OTP verification.'
  })
  @Get('me')
  me(@Headers(sessionHeaderName) sessionToken?: string) {
    return this.authService.requireSessionUser(sessionToken);
  }

  @ApiHeader({
    name: sessionHeaderName,
    required: true,
    description: 'Session token returned from OTP verification.'
  })
  @Post('logout')
  logout(@Headers(sessionHeaderName) sessionToken?: string) {
    return this.authService.logout(sessionToken);
  }
}
