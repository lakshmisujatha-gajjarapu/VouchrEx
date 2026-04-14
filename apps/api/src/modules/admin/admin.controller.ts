import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import {
  AdminRole,
  DisputeStatus,
  EscrowStatus,
  OrderStatus,
  PaymentStatus,
  PayoutStatus,
  UserStatus
} from '@prisma/client';

import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAccessService } from './admin-access.service';
import { adminHeaderName } from './admin.constants';
import { ADMIN_ROUTES } from './admin.routes';

@ApiTags('admin')
@Controller(ADMIN_ROUTES.BASE)
export class AdminController {
  constructor(
    private readonly adminAccessService: AdminAccessService,
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService
  ) {}

  /** Platform-wide operational metrics. */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Get(ADMIN_ROUTES.METRICS)
  async getMetrics(@Headers(adminHeaderName) adminToken?: string) {
    await this.adminAccessService.requireAdminAccess(adminToken);

    const [
      totalOrders,
      escrowActive,
      openDisputes,
      disputesUnderReview,
      totalCaptured,
      totalRefunded,
      activeListings,
      totalUsers
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: OrderStatus.ESCROW_ACTIVE } }),
      this.prisma.dispute.count({ where: { status: DisputeStatus.OPEN } }),
      this.prisma.dispute.count({ where: { status: DisputeStatus.UNDER_REVIEW } }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.CAPTURED },
        _sum: { amount: true }
      }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.REFUNDED },
        _sum: { amount: true }
      }),
      this.prisma.voucherListing.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count()
    ]);

    return {
      orders: { total: totalOrders, escrowActive },
      disputes: { open: openDisputes, underReview: disputesUnderReview },
      payments: {
        totalCapturedInr: totalCaptured._sum.amount ?? 0,
        totalRefundedInr: totalRefunded._sum.amount ?? 0
      },
      listings: { active: activeListings },
      users: { total: totalUsers },
      generatedAt: new Date().toISOString()
    };
  }

  /** List open and under-review disputes for admin triage. */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Get(ADMIN_ROUTES.DISPUTES)
  async getDisputes(
    @Headers(adminHeaderName) adminToken?: string,
    @Query('status') status?: string
  ) {
    await this.adminAccessService.requireAdminAccess(adminToken);

    const statusFilter =
      status === 'OPEN'
        ? DisputeStatus.OPEN
        : status === 'UNDER_REVIEW'
          ? DisputeStatus.UNDER_REVIEW
          : status === 'RESOLVED'
            ? DisputeStatus.RESOLVED
            : undefined;

    return this.prisma.dispute.findMany({
      where: statusFilter
        ? { status: statusFilter }
        : { status: { in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW] } },
      include: {
        order: {
          include: {
            listing: { include: { brand: true } },
            buyer: { select: { id: true, name: true, phone: true } },
            seller: { select: { id: true, name: true, phone: true } },
            payment: true
          }
        },
        raisedBy: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  /** List orders with optional status filter. */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Get(ADMIN_ROUTES.ORDERS)
  async getOrders(
    @Headers(adminHeaderName) adminToken?: string,
    @Query('status') status?: string
  ) {
    await this.adminAccessService.requireAdminAccess(adminToken);
    return this.prisma.order.findMany({
      ...(status ? { where: { status: status as OrderStatus } } : {}),
      include: {
        listing: { include: { brand: true } },
        buyer: { select: { id: true, name: true, phone: true } },
        seller: { select: { id: true, name: true, phone: true } },
        payment: true,
        dispute: true
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  /** List users with optional status filter. */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Get(ADMIN_ROUTES.USERS)
  async getUsers(
    @Headers(adminHeaderName) adminToken?: string,
    @Query('status') status?: string
  ) {
    await this.adminAccessService.requireAdminAccess(adminToken);
    return this.prisma.user.findMany({
      ...(status ? { where: { status: status as UserStatus } } : {}),
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        tier: true,
        trustScore: true,
        status: true,
        disputeCount: true,
        totalSales: true,
        createdAt: true,
        payoutAccount: {
          select: { kycStatus: true, upiId: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  /** Manually approve KYC for a seller (accounts are auto-verified on registration; use this to re-approve after a rejection). */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Post(ADMIN_ROUTES.USER_APPROVE_KYC)
  async approveKyc(
    @Param('id') id: string,
    @Headers(adminHeaderName) adminToken?: string
  ) {
    await this.adminAccessService.requireAdminAccess(adminToken);

    const account = await this.prisma.sellerPayoutAccount.update({
      where: { userId: id },
      data: { kycStatus: 'VERIFIED', verifiedAt: new Date() }
    });

    await this.prisma.auditLog.create({
      data: {
        entityType: 'sellerPayoutAccount',
        entityId: account.id,
        action: 'kyc.approved',
        actorId: null,
        metadata: { userId: id }
      }
    });

    return account;
  }

  /** Manually reject KYC for a seller — payouts will be blocked until re-approved. */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Post(ADMIN_ROUTES.USER_REJECT_KYC)
  async rejectKyc(
    @Param('id') id: string,
    @Headers(adminHeaderName) adminToken?: string
  ) {
    await this.adminAccessService.requireAdminAccess(adminToken);

    const account = await this.prisma.sellerPayoutAccount.update({
      where: { userId: id },
      data: { kycStatus: 'REJECTED' }
    });

    await this.prisma.auditLog.create({
      data: {
        entityType: 'sellerPayoutAccount',
        entityId: account.id,
        action: 'kyc.rejected',
        actorId: null,
        metadata: { userId: id }
      }
    });

    return account;
  }

  /** Suspend a user account. Immediately invalidates all their sessions. */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Post(ADMIN_ROUTES.USER_SUSPEND)
  async suspendUser(
    @Param('id') id: string,
    @Headers(adminHeaderName) adminToken?: string
  ) {
    await this.adminAccessService.requireAdminAccess(adminToken);

    const user = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.SUSPENDED }
    });

    await this.prisma.auditLog.create({
      data: {
        entityType: 'user',
        entityId: id,
        action: 'user.suspended',
        actorId: null,
        metadata: {}
      }
    });

    return user;
  }

  /** Reactivate a suspended user account. */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Post(ADMIN_ROUTES.USER_REACTIVATE)
  async reactivateUser(
    @Param('id') id: string,
    @Headers(adminHeaderName) adminToken?: string
  ) {
    await this.adminAccessService.requireAdminAccess(adminToken);

    const user = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.ACTIVE }
    });

    await this.prisma.auditLog.create({
      data: {
        entityType: 'user',
        entityId: id,
        action: 'user.reactivated',
        actorId: null,
        metadata: {}
      }
    });

    return user;
  }

  /**
   * Orders where payout is PENDING (no payout account) or FAILED (Razorpay error).
   * These need admin attention.
   */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Get(ADMIN_ROUTES.PAYOUTS_PENDING)
  async getPendingPayouts(@Headers(adminHeaderName) adminToken?: string) {
    await this.adminAccessService.requireAdminAccess(adminToken);

    return this.prisma.order.findMany({
      where: {
        payment: {
          escrowStatus: EscrowStatus.RELEASED,
          payoutStatus: { in: [PayoutStatus.PENDING, PayoutStatus.FAILED] }
        }
      },
      include: {
        payment: true,
        buyer: { select: { id: true, name: true, phone: true } },
        seller: {
          select: {
            id: true,
            name: true,
            phone: true,
            payoutAccount: true
          }
        },
        listing: { include: { brand: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  /**
   * Retry a failed auto-payout. Calls Razorpay Payouts API again using the
   * seller's registered fund account.
   */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Post(ADMIN_ROUTES.ORDER_RETRY_PAYOUT)
  async retryPayout(
    @Param('orderId') orderId: string,
    @Headers(adminHeaderName) adminToken?: string
  ) {
    await this.adminAccessService.requireAdminAccess(adminToken);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payment: true,
        seller: { select: { id: true, payoutAccount: true } }
      }
    });

    if (!order?.payment) {
      return { success: false, message: 'Order or payment not found.' };
    }
    if (order.payment.payoutStatus === PayoutStatus.COMPLETED) {
      return { success: false, message: 'Payout already completed.' };
    }
    if (order.payment.payoutStatus === PayoutStatus.PROCESSING) {
      return { success: false, message: 'Payout already processing — check Razorpay dashboard.' };
    }

    const payoutAccount = order.seller.payoutAccount;
    const fundAccountId = payoutAccount?.razorpayFundAccountId;
    if (!fundAccountId) {
      return { success: false, message: 'Seller has no registered payout account.' };
    }

    try {
      const razorpayPayoutId = await this.paymentsService.executePayout(
        fundAccountId,
        order.sellerPayout,
        orderId,
        payoutAccount.type
      );
      const updated = await this.prisma.payment.update({
        where: { orderId },
        data: {
          payoutStatus: PayoutStatus.PROCESSING,
          razorpayPayoutId,
          payoutInitiatedAt: new Date(),
          payoutFailureReason: null
        }
      });
      await this.prisma.auditLog.create({
        data: {
          entityType: 'payment',
          entityId: order.payment.id,
          action: 'payment.payout_retried',
          actorId: null,
          metadata: { orderId, razorpayPayoutId }
        }
      });
      return { success: true, payment: updated };
    } catch (err) {
      return { success: false, message: String(err) };
    }
  }

  /**
   * Manually mark a payout as completed — fallback for edge cases where
   * funds were transferred outside Razorpay (e.g., IMPS from bank directly).
   */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Post(ADMIN_ROUTES.ORDER_COMPLETE_PAYOUT)
  async completePayout(
    @Param('orderId') orderId: string,
    @Headers(adminHeaderName) adminToken?: string
  ) {
    await this.adminAccessService.requireAdminAccess(adminToken);

    const payment = await this.prisma.payment.findUnique({ where: { orderId } });
    if (!payment) {
      return { success: false, message: 'No payment found for this order.' };
    }
    if (payment.payoutStatus === PayoutStatus.COMPLETED) {
      return { success: false, message: 'Payout already completed.' };
    }

    const updated = await this.prisma.payment.update({
      where: { orderId },
      data: {
        payoutStatus: PayoutStatus.COMPLETED,
        payoutCompletedAt: new Date()
      }
    });

    await this.prisma.auditLog.create({
      data: {
        entityType: 'payment',
        entityId: payment.id,
        action: 'payment.payout_completed_manually',
        actorId: null,
        metadata: { orderId }
      }
    });

    return { success: true, payment: updated };
  }

  // ─── Admin Auth ───────────────────────────────────────────────────────────────

  /** Login with email + password. Returns a session token (8h TTL). */
  @Post(ADMIN_ROUTES.AUTH_LOGIN)
  async adminLogin(@Body() body: { email: string; password: string }) {
    return this.adminAccessService.login(body.email, body.password);
  }

  /** Logout — revokes the current session token. */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Post(ADMIN_ROUTES.AUTH_LOGOUT)
  async adminLogout(@Headers(adminHeaderName) adminToken?: string) {
    await this.adminAccessService.logout(adminToken);
    return { success: true };
  }

  /** Get the currently authenticated admin's profile. */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Get(ADMIN_ROUTES.ME)
  async getMe(@Headers(adminHeaderName) adminToken?: string) {
    const identity = await this.adminAccessService.requireAdminAccess(adminToken);
    if (identity.kind === 'bootstrap') {
      return { id: null, name: 'Bootstrap', email: null, role: 'SUPER_ADMIN', kind: 'bootstrap' };
    }
    return { id: identity.adminId, name: identity.name, email: identity.email, role: identity.role, kind: 'session' };
  }

  // ─── Team Management (SUPER_ADMIN only) ──────────────────────────────────────

  /** List all admin users. */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Get(ADMIN_ROUTES.TEAM)
  async getTeam(@Headers(adminHeaderName) adminToken?: string) {
    await this.adminAccessService.requireSuperAdmin(adminToken);
    return this.prisma.adminUser.findMany({
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    });
  }

  /** Create a new admin user. */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Post(ADMIN_ROUTES.TEAM)
  async createTeamMember(
    @Body() body: { email: string; name: string; password: string; role?: AdminRole },
    @Headers(adminHeaderName) adminToken?: string
  ) {
    await this.adminAccessService.requireSuperAdmin(adminToken);
    return this.adminAccessService.createAdminUser({
      email: body.email,
      name: body.name,
      password: body.password,
      ...(body.role ? { role: body.role } : {})
    });
  }

  /** Deactivate an admin user (blocks login, revokes all sessions). */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Post(ADMIN_ROUTES.TEAM_MEMBER_DEACTIVATE)
  async deactivateTeamMember(
    @Param('id') id: string,
    @Headers(adminHeaderName) adminToken?: string
  ) {
    await this.adminAccessService.requireSuperAdmin(adminToken);
    await this.prisma.adminUser.update({ where: { id }, data: { active: false } });
    await this.prisma.adminSession.updateMany({
      where: { adminId: id, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    return { success: true };
  }

  /** Reactivate a deactivated admin user. */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Post(ADMIN_ROUTES.TEAM_MEMBER_ACTIVATE)
  async activateTeamMember(
    @Param('id') id: string,
    @Headers(adminHeaderName) adminToken?: string
  ) {
    await this.adminAccessService.requireSuperAdmin(adminToken);
    await this.prisma.adminUser.update({ where: { id }, data: { active: true } });
    return { success: true };
  }

  /** Set a new password for an admin user. Revokes all their existing sessions. */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Post(ADMIN_ROUTES.TEAM_MEMBER_SET_PASSWORD)
  async setTeamMemberPassword(
    @Param('id') id: string,
    @Body() body: { password: string },
    @Headers(adminHeaderName) adminToken?: string
  ) {
    await this.adminAccessService.requireSuperAdmin(adminToken);
    await this.adminAccessService.setPassword(id, body.password);
    return { success: true };
  }
}
