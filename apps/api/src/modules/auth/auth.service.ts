import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { OtpPurpose, UserStatus } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';

import { ONE_DAY_MS, ONE_HOUR_MS, ONE_MINUTE_MS } from '../../common/time.constants';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACCESS_TOKEN_TTL_MINUTES_DEFAULT,
  OTP_MAX_ATTEMPTS_DEFAULT,
  OTP_MAX_DISTINCT_PHONES_PER_DEVICE_DAY_DEFAULT,
  OTP_MAX_PER_DEVICE_HOUR_DEFAULT,
  OTP_MAX_PER_PHONE_HOUR_DEFAULT,
  OTP_RESEND_COOLDOWN_SECONDS_DEFAULT,
  REFRESH_TOKEN_TTL_DAYS_DEFAULT,
  SESSION_TOKEN_BYTE_LENGTH
} from './auth.constants';
import { RequestOtpDto } from './dto/request-otp.dto';
import { OtpProviderService } from './otp-provider.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Injectable()
export class AuthService {
  private readonly maxOtpAttempts = Number(process.env.OTP_MAX_ATTEMPTS ?? OTP_MAX_ATTEMPTS_DEFAULT);
  private readonly accessTokenTtlMinutes = Number(process.env.ACCESS_TOKEN_TTL_MINUTES ?? ACCESS_TOKEN_TTL_MINUTES_DEFAULT);
  private readonly refreshTokenTtlDays = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? REFRESH_TOKEN_TTL_DAYS_DEFAULT);
  private readonly otpResendCooldownSeconds = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? OTP_RESEND_COOLDOWN_SECONDS_DEFAULT);
  private readonly otpMaxPerPhoneHour = Number(process.env.OTP_MAX_PER_PHONE_HOUR ?? OTP_MAX_PER_PHONE_HOUR_DEFAULT);
  private readonly otpMaxPerDeviceHour = Number(process.env.OTP_MAX_PER_DEVICE_HOUR ?? OTP_MAX_PER_DEVICE_HOUR_DEFAULT);
  private readonly otpMaxDistinctPhonesPerDeviceDay = Number(process.env.OTP_MAX_DISTINCT_PHONES_PER_DEVICE_DAY ?? OTP_MAX_DISTINCT_PHONES_PER_DEVICE_DAY_DEFAULT);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otpProviderService: OtpProviderService
  ) {}

  async requestOtp(dto: RequestOtpDto, clientIp?: string) {
    const phone = this.normalizePhone(dto.phone);
    const deviceId = dto.deviceId ?? null;
    const now = Date.now();
    const oneHourAgo = new Date(now - ONE_HOUR_MS);
    const oneDayAgo = new Date(now - ONE_DAY_MS);

    // All rate limits are skipped outside production to avoid frustrating developers
    if (process.env.NODE_ENV === 'production') {
      // Resend cooldown: block requests within OTP_RESEND_COOLDOWN_SECONDS of the last one
      const lastChallenge = await this.prisma.otpChallenge.findFirst({
        where: { phone },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      });
      if (lastChallenge) {
        const secondsSinceLast = (now - lastChallenge.createdAt.getTime()) / 1000;
        if (secondsSinceLast < this.otpResendCooldownSeconds) {
          const waitSeconds = Math.ceil(this.otpResendCooldownSeconds - secondsSinceLast);
          throw new BadRequestException(`Please wait ${String(waitSeconds)}s before requesting a new code.`);
        }
      }

      // Rate limit: max OTP_MAX_PER_PHONE_HOUR requests per phone per hour
      const phoneHourCount = await this.prisma.otpChallenge.count({
        where: { phone, createdAt: { gte: oneHourAgo } }
      });
      if (phoneHourCount >= this.otpMaxPerPhoneHour) {
        throw new BadRequestException('Too many OTP requests. Please wait before requesting a new code.');
      }

      // Device-level checks (only when deviceId is provided)
      if (deviceId) {
        // Check if this device is associated with a suspended/blocked user
        const suspendedOnDevice = await this.prisma.otpChallenge.findFirst({
          where: {
            deviceId,
            createdAt: { gte: oneDayAgo }
          },
          select: { phone: true },
          distinct: ['phone']
        });
        if (suspendedOnDevice) {
          // Check all phones seen from this device for suspended/blocked users
          const phonesFromDevice = await this.prisma.otpChallenge.findMany({
            where: { deviceId, createdAt: { gte: oneDayAgo } },
            select: { phone: true },
            distinct: ['phone']
          });
          const uniquePhones = phonesFromDevice.map((r) => r.phone);
          const suspendedUser = await this.prisma.user.findFirst({
            where: {
              phone: { in: uniquePhones },
              status: { in: [UserStatus.SUSPENDED, UserStatus.BLOCKED] }
            },
            select: { id: true }
          });
          if (suspendedUser) {
            throw new ForbiddenException('Account access restricted from this device.');
          }
        }

        // Rate limit: max OTP_MAX_PER_DEVICE_HOUR requests per device per hour
        const deviceHourCount = await this.prisma.otpChallenge.count({
          where: { deviceId, createdAt: { gte: oneHourAgo } }
        });
        if (deviceHourCount >= this.otpMaxPerDeviceHour) {
          throw new BadRequestException('Too many OTP requests from this device. Please wait.');
        }

        // Multi-account signal: max OTP_MAX_DISTINCT_PHONES_PER_DEVICE_DAY distinct phones per device per day
        const distinctPhonesOnDevice = await this.prisma.otpChallenge.findMany({
          where: { deviceId, createdAt: { gte: oneDayAgo } },
          select: { phone: true },
          distinct: ['phone']
        });
        const phonesNotCurrentPhone = distinctPhonesOnDevice.filter((r) => r.phone !== phone);
        if (phonesNotCurrentPhone.length >= this.otpMaxDistinctPhonesPerDeviceDay) {
          throw new BadRequestException('Too many accounts accessed from this device.');
        }
      }
    }

    const otpChallenge = this.otpProviderService.startVerification(phone);

    await this.prisma.otpChallenge.create({
      data: {
        phone,
        purpose: OtpPurpose.LOGIN,
        provider: otpChallenge.provider,
        codeHash: otpChallenge.codeHash,
        expiresAt: otpChallenge.expiresAt,
        deviceId,
        clientIp: clientIp ?? null
      }
    });

    const existingUser = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true }
    });

    await this.prisma.auditLog.create({
      data: {
        entityType: 'auth',
        entityId: phone,
        action: 'otp.requested',
        metadata: {
          phone
        }
      }
    });

    const deliveryChannel = otpChallenge.provider === 'DEV' ? 'debug' : 'sms';

    return {
      phone,
      expiresAt: otpChallenge.expiresAt,
      deliveryChannel,
      isNewUser: !existingUser,
      ...(dto.name ? { pendingProfileName: dto.name } : {}),
      ...(otpChallenge.provider === 'DEV' ? { debugCode: otpChallenge.debugCode } : {})
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const phone = this.normalizePhone(dto.phone);
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        phone,
        purpose: OtpPurpose.LOGIN,
        consumedAt: null
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!challenge) {
      throw new BadRequestException('No active OTP challenge was found for this phone number.');
    }

    if (challenge.expiresAt <= new Date()) {
      throw new BadRequestException('OTP has expired. Request a new code.');
    }

    if (challenge.attempts >= this.maxOtpAttempts) {
      throw new BadRequestException('OTP retry limit reached. Request a new code.');
    }

    const isValidOtp = await this.otpProviderService.verifyOtp({
      phone,
      provider: challenge.provider,
      providerRequestId: challenge.providerRequestId ?? null,
      storedCodeHash: challenge.codeHash,
      code: dto.code
    });

    if (!isValidOtp) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: {
          attempts: {
            increment: 1
          }
        }
      });

      throw new BadRequestException('OTP is invalid.');
    }

    const now = new Date();
    const { accessToken, accessTokenHash, accessTokenExpiresAt, refreshToken, refreshTokenHash, refreshTokenExpiresAt } =
      this.generateTokenPair(now);

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.otpChallenge.update({
        where: { id: challenge.id },
        data: {
          consumedAt: now
        }
      });

      const resolvedUser = await tx.user.upsert({
        where: { phone },
        update: {
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.email ? { email: dto.email } : {})
        },
        create: {
          phone,
          name: dto.name ?? `User ${phone.slice(-4)}`,
          ...(dto.email ? { email: dto.email } : {})
        },
        select: {
          id: true,
          phone: true,
          name: true,
          email: true,
          status: true,
          tier: true,
          totalSales: true
        }
      });

      if (resolvedUser.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Your account has been suspended. Please contact support.');
      }

      await tx.userSession.create({
        data: {
          userId: resolvedUser.id,
          accessTokenHash,
          accessTokenExpiresAt,
          refreshTokenHash,
          refreshTokenExpiresAt,
          deviceId: dto.deviceId ?? null,
          lastUsedAt: now
        }
      });

      await tx.auditLog.create({
        data: {
          entityType: 'auth',
          entityId: resolvedUser.id,
          action: 'otp.verified',
          actorId: resolvedUser.id,
          metadata: {
            phone
          }
        }
      });

      return resolvedUser;
    });

    return {
      accessToken,
      accessTokenExpiresAt,
      refreshToken,
      refreshTokenExpiresAt,
      user
    };
  }

  async refreshTokens(dto: RefreshTokenDto) {
    const incomingHash = this.hashToken(dto.refreshToken);

    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: incomingHash },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            name: true,
            email: true,
            status: true,
            tier: true,
            totalSales: true
          }
        }
      }
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    // Reuse detection: this token was already rotated — likely stolen
    if (session.refreshTokenConsumedAt) {
      await this.prisma.userSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
      await this.prisma.auditLog.create({
        data: {
          entityType: 'auth',
          entityId: session.userId,
          action: 'auth.refresh_token_reuse_detected',
          actorId: session.userId,
          metadata: { deviceId: session.deviceId }
        }
      });
      throw new UnauthorizedException('Session invalidated due to suspicious activity. Please sign in again.');
    }

    if (session.revokedAt) {
      throw new UnauthorizedException('Session has been revoked. Please sign in again.');
    }

    if (session.refreshTokenExpiresAt <= new Date()) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    if (session.user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Your account has been suspended. Please contact support.');
    }

    const now = new Date();
    const { accessToken, accessTokenHash, accessTokenExpiresAt, refreshToken, refreshTokenHash, refreshTokenExpiresAt } =
      this.generateTokenPair(now);

    await this.prisma.$transaction(async (tx) => {
      // Mark old refresh token as consumed (rotation — invalidates it for future use)
      await tx.userSession.update({
        where: { id: session.id },
        data: { refreshTokenConsumedAt: now }
      });

      // Create new session with rotated tokens; sliding: refreshTokenExpiresAt resets from now
      await tx.userSession.create({
        data: {
          userId: session.userId,
          accessTokenHash,
          accessTokenExpiresAt,
          refreshTokenHash,
          refreshTokenExpiresAt,
          deviceId: session.deviceId,
          lastUsedAt: now
        }
      });
    });

    return {
      accessToken,
      accessTokenExpiresAt,
      refreshToken,
      refreshTokenExpiresAt
    };
  }

  async getSessionUser(sessionToken: string | undefined) {
    if (!sessionToken) {
      return null;
    }

    const tokenHash = this.hashToken(sessionToken);
    const session = await this.prisma.userSession.findUnique({
      where: { accessTokenHash: tokenHash },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            name: true,
            email: true,
            status: true,
            tier: true,
            totalSales: true
          }
        }
      }
    });

    if (!session || session.revokedAt || session.accessTokenExpiresAt <= new Date()) {
      return null;
    }

    // Block suspended/banned users immediately even if they have a valid token
    if (session.user.status !== UserStatus.ACTIVE) {
      return null;
    }

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() }
    });

    return session.user;
  }

  async requireSessionUser(sessionToken: string | undefined) {
    const user = await this.getSessionUser(sessionToken);
    if (!user) {
      throw new UnauthorizedException('A valid session token is required.');
    }

    return user;
  }

  async logout(sessionToken: string | undefined) {
    if (!sessionToken) {
      throw new UnauthorizedException('A valid session token is required.');
    }

    const tokenHash = this.hashToken(sessionToken);
    const session = await this.prisma.userSession.findUnique({
      where: { accessTokenHash: tokenHash }
    });

    if (!session || session.revokedAt) {
      throw new UnauthorizedException('Session is invalid or already revoked.');
    }

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() }
    });

    return { success: true };
  }

  private generateTokenPair(now: Date) {
    const accessToken = randomBytes(SESSION_TOKEN_BYTE_LENGTH).toString('hex');
    const refreshToken = randomBytes(SESSION_TOKEN_BYTE_LENGTH).toString('hex');
    const accessTokenExpiresAt = new Date(now.getTime() + this.accessTokenTtlMinutes * ONE_MINUTE_MS);
    const refreshTokenExpiresAt = new Date(now.getTime() + this.refreshTokenTtlDays * ONE_DAY_MS);

    return {
      accessToken,
      accessTokenHash: this.hashToken(accessToken),
      accessTokenExpiresAt,
      refreshToken,
      refreshTokenHash: this.hashToken(refreshToken),
      refreshTokenExpiresAt
    };
  }

  private normalizePhone(phone: string) {
    return `+${phone.replace(/\D/g, '')}`;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
