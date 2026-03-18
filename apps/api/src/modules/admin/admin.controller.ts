import { Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import {
  DisputeStatus,
  OrderStatus,
  PaymentStatus,
  UserStatus
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AdminAccessService } from './admin-access.service';
import { adminHeaderName } from './admin.constants';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminAccessService: AdminAccessService,
    private readonly prisma: PrismaService
  ) {}

  /** Platform-wide operational metrics. */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Get('metrics')
  async getMetrics(@Headers(adminHeaderName) adminToken?: string) {
    this.adminAccessService.requireAdminAccess(adminToken);

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
  @Get('disputes')
  async getDisputes(
    @Headers(adminHeaderName) adminToken?: string,
    @Query('status') status?: string
  ) {
    this.adminAccessService.requireAdminAccess(adminToken);

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
  @Get('orders')
  async getOrders(
    @Headers(adminHeaderName) adminToken?: string,
    @Query('status') status?: string
  ) {
    this.adminAccessService.requireAdminAccess(adminToken);
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
  @Get('users')
  async getUsers(
    @Headers(adminHeaderName) adminToken?: string,
    @Query('status') status?: string
  ) {
    this.adminAccessService.requireAdminAccess(adminToken);
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
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  /** Suspend a user account. Immediately invalidates all their sessions. */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Post('users/:id/suspend')
  async suspendUser(
    @Param('id') id: string,
    @Headers(adminHeaderName) adminToken?: string
  ) {
    this.adminAccessService.requireAdminAccess(adminToken);

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
  @Post('users/:id/reactivate')
  async reactivateUser(
    @Param('id') id: string,
    @Headers(adminHeaderName) adminToken?: string
  ) {
    this.adminAccessService.requireAdminAccess(adminToken);

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

  /** Orders where escrow is released but payout has not been completed. */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Get('payouts/pending')
  async getPendingPayouts(@Headers(adminHeaderName) adminToken?: string) {
    this.adminAccessService.requireAdminAccess(adminToken);

    return this.prisma.order.findMany({
      where: {
        payment: {
          escrowStatus: 'RELEASED',
          payoutCompletedAt: null
        }
      },
      include: {
        payment: true,
        buyer: { select: { id: true, name: true, phone: true } },
        seller: { select: { id: true, name: true, phone: true } },
        listing: { include: { brand: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  /**
   * Mark a payout as manually completed by the admin.
   * Used after admin manually transfers funds to seller outside the platform (Phase 1).
   */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Post('orders/:orderId/complete-payout')
  async completePayout(
    @Param('orderId') orderId: string,
    @Headers(adminHeaderName) adminToken?: string
  ) {
    this.adminAccessService.requireAdminAccess(adminToken);

    const payment = await this.prisma.payment.findUnique({ where: { orderId } });
    if (!payment) {
      return { success: false, message: 'No payment found for this order.' };
    }
    if (payment.payoutCompletedAt) {
      return { success: false, message: 'Payout already marked as completed.' };
    }

    const updated = await this.prisma.payment.update({
      where: { orderId },
      data: { payoutCompletedAt: new Date() }
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
}
