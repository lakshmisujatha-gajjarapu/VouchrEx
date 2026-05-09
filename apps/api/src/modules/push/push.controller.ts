import { Body, Controller, Delete, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';

import { AuthService } from '../auth/auth.service';
import { sessionHeaderName } from '../auth/auth.constants';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushClient } from './expo-push.client';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

@ApiTags('push')
@ApiHeader({
  name: sessionHeaderName,
  required: true,
  description: 'Session token returned from OTP verification.'
})
@Controller('me/push-tokens')
export class PushController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly expoClient: ExpoPushClient
  ) {}

  @Post()
  async register(
    @Headers(sessionHeaderName) sessionToken: string | undefined,
    @Body() dto: RegisterPushTokenDto
  ) {
    const user = await this.authService.requireSessionUser(sessionToken);

    if (!this.expoClient.isValidToken(dto.token)) {
      throw new UnauthorizedException('Invalid Expo push token');
    }

    return this.prisma.pushToken.upsert({
      where: { userId_deviceId: { userId: user.id, deviceId: dto.deviceId } },
      create: { userId: user.id, deviceId: dto.deviceId, token: dto.token, platform: dto.platform },
      update: { token: dto.token, platform: dto.platform }
    });
  }

  @Delete(':deviceId')
  async unregister(
    @Headers(sessionHeaderName) sessionToken: string | undefined,
    @Param('deviceId') deviceId: string
  ) {
    const user = await this.authService.requireSessionUser(sessionToken);
    await this.prisma.pushToken.deleteMany({
      where: { userId: user.id, deviceId }
    });
    return { ok: true };
  }
}
