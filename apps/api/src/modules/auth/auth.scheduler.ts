import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { ONE_DAY_MS, ONE_HOUR_MS } from '../../common/time.constants';
import { PrismaService } from '../prisma/prisma.service';
import {
  AUDIT_RETENTION_DAYS_DEFAULT,
  OTP_CHALLENGE_GRACE_HOURS_DEFAULT
} from './auth.constants';

/** Retain revoked/expired records for this many days before hard-deleting. */
const auditRetentionDays = Number(process.env.AUDIT_RETENTION_DAYS ?? AUDIT_RETENTION_DAYS_DEFAULT);

@Injectable()
export class AuthScheduler {
  private readonly logger = new Logger(AuthScheduler.name);
  private isRunning = false;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Daily at 03:00 UTC: prune consumed/expired OTP challenges and
   * stale/revoked sessions that are past their audit-retention window.
   *
   * OTPs: PII (phone + code hash) — delete promptly after expiry.
   * Sessions: keep 7 days post-expiry for audit trail, then hard-delete.
   */
  @Cron('0 3 * * *')
  async handleAuthCleanup() {
    if (this.isRunning) {
      this.logger.warn('handleAuthCleanup still running — skipping tick.');
      return;
    }
    this.isRunning = true;
    try {
      await this.pruneOtpChallenges();
      await this.pruneSessions();
    } catch (error) {
      this.logger.error(`handleAuthCleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.isRunning = false;
    }
  }

  private async pruneOtpChallenges() {
    // Delete challenges that are either consumed or expired (past OTP TTL).
    // Keep a 24-hour grace window so ops can inspect recent auth failures.
    const otpChallengeGraceHours = Number(process.env.OTP_CHALLENGE_GRACE_HOURS ?? OTP_CHALLENGE_GRACE_HOURS_DEFAULT);
    const cutoff = new Date(Date.now() - otpChallengeGraceHours * ONE_HOUR_MS);

    const { count } = await this.prisma.otpChallenge.deleteMany({
      where: {
        OR: [
          { consumedAt: { not: null } },
          { expiresAt: { lte: new Date() } }
        ],
        createdAt: { lte: cutoff }
      }
    });

    if (count > 0) {
      this.logger.log(`Pruned ${String(count)} expired/consumed OTP challenge(s).`);
    }
  }

  private async pruneSessions() {
    const retentionCutoff = new Date(Date.now() - auditRetentionDays * ONE_DAY_MS);

    // A session is fully dead when its refresh token has expired (the longer-lived token).
    // Consumed sessions (rotated) and revoked sessions are also pruned after the retention window.
    const { count } = await this.prisma.userSession.deleteMany({
      where: {
        OR: [
          { refreshTokenExpiresAt: { lte: retentionCutoff } },
          { revokedAt: { not: null, lte: retentionCutoff } },
          { refreshTokenConsumedAt: { not: null, lte: retentionCutoff } }
        ]
      }
    });

    if (count > 0) {
      this.logger.log(`Pruned ${String(count)} stale/revoked session(s).`);
    }
  }
}
