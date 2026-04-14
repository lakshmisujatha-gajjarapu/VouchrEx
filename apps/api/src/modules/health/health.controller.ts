import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { PrismaService } from '../prisma/prisma.service';
import { HEALTH_ROUTES } from './health.routes';

@SkipThrottle()
@ApiTags('health')
@Controller(HEALTH_ROUTES.BASE)
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getHealth() {
    let dbOk = true;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbOk = false;
    }

    const body = {
      status: dbOk ? 'ok' : 'degraded',
      service: 'vouchrex-api',
      phase: 'phase-1-mvp',
      checks: {
        db: dbOk ? 'ok' : 'error'
      },
      timestamp: new Date().toISOString()
    };

    if (!dbOk) {
      throw new HttpException(body, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return body;
  }
}
