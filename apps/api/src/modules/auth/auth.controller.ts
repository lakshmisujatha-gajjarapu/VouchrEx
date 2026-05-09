import { Body, Controller, Get, Headers, Ip, Post } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
  REQUEST_OTP_THROTTLE_MEDIUM,
  REQUEST_OTP_THROTTLE_SHORT,
  VERIFY_OTP_THROTTLE_MEDIUM,
  VERIFY_OTP_THROTTLE_SHORT,
  sessionHeaderName
} from './auth.constants';
import { AUTH_ROUTES } from './auth.routes';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('auth')
@Controller(AUTH_ROUTES.BASE)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Tight limit: 1 OTP request per 10s, 5 per minute to deter brute force / SMS flooding
  @Throttle({ short: REQUEST_OTP_THROTTLE_SHORT, medium: REQUEST_OTP_THROTTLE_MEDIUM })
  @Post(AUTH_ROUTES.OTP_REQUEST)
  requestOtp(@Body() requestOtpDto: RequestOtpDto, @Ip() clientIp: string) {
    return this.authService.requestOtp(requestOtpDto, clientIp);
  }

  // 5 verify attempts per minute per IP (service-layer also limits per phone)
  @Throttle({ short: VERIFY_OTP_THROTTLE_SHORT, medium: VERIFY_OTP_THROTTLE_MEDIUM })
  @Post(AUTH_ROUTES.OTP_VERIFY)
  verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @Post(AUTH_ROUTES.TOKEN_REFRESH)
  refreshTokens(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto);
  }

  @ApiHeader({
    name: sessionHeaderName,
    required: true,
    description: 'Access token returned from OTP verification or token refresh.'
  })
  @Get(AUTH_ROUTES.ME)
  me(@Headers(sessionHeaderName) sessionToken?: string) {
    return this.authService.requireSessionUser(sessionToken);
  }

  @ApiHeader({
    name: sessionHeaderName,
    required: true,
    description: 'Session token returned from OTP verification.'
  })
  @Post(AUTH_ROUTES.LOGOUT)
  logout(@Headers(sessionHeaderName) sessionToken?: string) {
    return this.authService.logout(sessionToken);
  }
}
