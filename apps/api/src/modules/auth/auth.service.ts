import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { OtpPurpose, UserStatus } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { OtpProviderService } from './otp-provider.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class AuthService {
  private readonly maxOtpAttempts = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);
  private readonly sessionTtlHours = Number(process.env.SESSION_TTL_HOURS ?? 24 * 30);
  private readonly otpResendCooldownSeconds = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 60);
  private readonly otpMaxPerPhoneHour = Number(process.env.OTP_MAX_PER_PHONE_HOUR ?? 3);
  private readonly otpMaxPerDeviceHour = Number(process.env.OTP_MAX_PER_DEVICE_HOUR ?? 4);
  private readonly otpMaxDistinctPhonesPerDeviceDay = Number(process.env.OTP_MAX_DISTINCT_PHONES_PER_DEVICE_DAY ?? 3);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otpProviderService: OtpProviderService
  ) {}

  async requestOtp(dto: RequestOtpDto, clientIp?: string) {
    const phone = this.normalizePhone(dto.phone);
    const deviceId = dto.deviceId ?? null;
    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

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
        throw new BadRequestException(`Please wait ${waitSeconds}s before requesting a new code.`);
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

    const otpChallenge = await this.otpProviderService.startVerification(phone);

    await this.prisma.otpChallenge.create({
      data: {
        phone,
        purpose: OtpPurpose.LOGIN,
        provider: otpChallenge.provider,
        codeHash: otpChallenge.codeHash,
        expiresAt: otpChallenge.expiresAt,
        deviceId,
        clientIp: clientIp ?? null,
        ...(otpChallenge.providerRequestId
          ? { providerRequestId: otpChallenge.providerRequestId }
          : {})
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

    return {
      phone,
      expiresAt: otpChallenge.expiresAt,
      deliveryChannel: otpChallenge.provider === 'DEV' ? 'debug' : 'sms',
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

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashSessionToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTtlHours * 60 * 60 * 1000);

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
          tier: true
        }
      });

      if (resolvedUser.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Your account has been suspended. Please contact support.');
      }

      await tx.userSession.create({
        data: {
          userId: resolvedUser.id,
          tokenHash,
          expiresAt,
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
      sessionToken: token,
      expiresAt,
      user
    };
  }

  async getSessionUser(sessionToken: string | undefined) {
    if (!sessionToken) {
      return null;
    }

    const tokenHash = this.hashSessionToken(sessionToken);
    const session = await this.prisma.userSession.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            name: true,
            email: true,
            status: true,
            tier: true
          }
        }
      }
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      return null;
    }

    // Block suspended/banned users immediately even if they have a valid session token
    if (session.user.status !== UserStatus.ACTIVE) {
      return null;
    }

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + this.sessionTtlHours * 60 * 60 * 1000)
      }
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

    const tokenHash = this.hashSessionToken(sessionToken);
    const session = await this.prisma.userSession.findUnique({
      where: { tokenHash }
    });

    if (!session || session.revokedAt) {
      throw new UnauthorizedException('Session is invalid or already revoked.');
    }

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date()
      }
    });

    return {
      success: true
    };
  }

  private normalizePhone(phone: string) {
    return `+${phone.replace(/\D/g, '')}`;
  }

  private hashSessionToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
