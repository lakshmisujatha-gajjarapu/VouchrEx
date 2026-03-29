import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';

export type AdminIdentity =
  | { kind: 'session'; adminId: string; role: AdminRole; name: string; email: string }
  | { kind: 'bootstrap'; adminId: null; role: AdminRole };

@Injectable()
export class AdminAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve admin identity from x-admin-token header. Never throws — returns null on failure. */
  async resolveIdentity(token: string | undefined): Promise<AdminIdentity | null> {
    if (!token) return null;

    // 1. Check AdminSession table
    const tokenHash = this.hashToken(token);
    const session = await this.prisma.adminSession.findUnique({
      where: { tokenHash },
      include: { admin: true }
    });

    if (session && !session.revokedAt && session.expiresAt > new Date() && session.admin.active) {
      return {
        kind: 'session',
        adminId: session.adminId,
        role: session.admin.role,
        name: session.admin.name,
        email: session.admin.email
      };
    }

    // 2. Fallback: static ADMIN_API_TOKEN (bootstrap mode)
    const configuredToken = process.env.ADMIN_API_TOKEN?.trim();
    if (configuredToken) {
      const expected = Buffer.from(configuredToken);
      const provided = Buffer.from(token);
      if (expected.length === provided.length && timingSafeEqual(expected, provided)) {
        return { kind: 'bootstrap', adminId: null, role: AdminRole.SUPER_ADMIN };
      }
    }

    return null;
  }

  /** Require any valid admin. */
  async requireAdminAccess(token: string | undefined): Promise<AdminIdentity> {
    const identity = await this.resolveIdentity(token);
    if (!identity) {
      const hasStaticToken = Boolean(process.env.ADMIN_API_TOKEN?.trim());
      if (!hasStaticToken) {
        throw new ServiceUnavailableException('Admin auth is not configured.');
      }
      throw new UnauthorizedException('Admin token is invalid or expired.');
    }
    return identity;
  }

  /** Require SUPER_ADMIN role. */
  async requireSuperAdmin(token: string | undefined): Promise<AdminIdentity> {
    const identity = await this.requireAdminAccess(token);
    if (identity.role !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Super admin access required.');
    }
    return identity;
  }

  /** Login: verify email + password, create session, return token. */
  async login(email: string, password: string): Promise<{ sessionToken: string; admin: { id: string; name: string; email: string; role: AdminRole } }> {
    const admin = await this.prisma.adminUser.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!admin || !admin.active) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8-hour session

    await this.prisma.adminSession.create({
      data: { adminId: admin.id, tokenHash, expiresAt }
    });

    return {
      sessionToken: token,
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role }
    };
  }

  /** Logout: revoke session. */
  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    const tokenHash = this.hashToken(token);
    await this.prisma.adminSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  /** Create a new admin user with the given password. */
  async createAdminUser(input: { email: string; name: string; password: string; role?: AdminRole }): Promise<object> {
    const passwordHash = await bcrypt.hash(input.password, 12);

    return this.prisma.adminUser.create({
      data: {
        email: input.email.toLowerCase().trim(),
        name: input.name.trim(),
        passwordHash,
        role: input.role ?? AdminRole.ADMIN
      },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true }
    });
  }

  /** Set a new password for an existing admin and revoke all their sessions. */
  async setPassword(adminId: string, password: string): Promise<void> {
    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.adminUser.update({ where: { id: adminId }, data: { passwordHash } });
    await this.prisma.adminSession.updateMany({
      where: { adminId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
