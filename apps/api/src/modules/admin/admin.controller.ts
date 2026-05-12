import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import {
  AdminRole,
  DisputeStatus,
  EscrowStatus,
  OrderStatus,
  PaymentStatus,
  PayoutStatus,
  RefundStatus,
  UserStatus
} from '@prisma/client';

import { parsePagination, normalizeSearch, normalizeQBy, containsCi, startsWithCi } from '../../common/pagination';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAccessService } from './admin-access.service';
import { adminHeaderName } from './admin.constants';
import { ADMIN_ROUTES } from './admin.routes';

/** Build a single-column search filter for /admin/orders. */
function buildOrderSearchWhere(search: string | undefined, key: string | undefined): object {
  if (!search || !key) return {};
  switch (key) {
    case 'id':           return { id: startsWithCi(search) };
    case 'buyerPhone':   return { buyer:  { phone: containsCi(search) } };
    case 'buyerName':    return { buyer:  { name:  containsCi(search) } };
    case 'sellerPhone':  return { seller: { phone: containsCi(search) } };
    case 'sellerName':   return { seller: { name:  containsCi(search) } };
    case 'brand':        return { listing: { brand: { name: containsCi(search) } } };
    default:             return {};
  }
}

/** Build a single-column search filter for /admin/disputes. */
function buildDisputeSearchWhere(search: string | undefined, key: string | undefined): object {
  if (!search || !key) return {};
  switch (key) {
    case 'id':           return { id: startsWithCi(search) };
    case 'orderId':      return { orderId: startsWithCi(search) };
    case 'buyerPhone':   return { order: { buyer:  { phone: containsCi(search) } } };
    case 'buyerName':    return { order: { buyer:  { name:  containsCi(search) } } };
    case 'sellerPhone':  return { order: { seller: { phone: containsCi(search) } } };
    case 'sellerName':   return { order: { seller: { name:  containsCi(search) } } };
    default:             return {};
  }
}

/** Build a single-column search filter for /admin/users. */
function buildUserSearchWhere(search: string | undefined, key: string | undefined): object {
  if (!search || !key) return {};
  switch (key) {
    case 'phone': return { phone: containsCi(search) };
    case 'name':  return { name:  containsCi(search) };
    case 'email': return { email: containsCi(search) };
    default:      return {};
  }
}

/** Build a single-column search filter for /admin/payouts/pending and /admin/refunds/pending. */
function buildOrderPartySearchWhere(search: string | undefined, key: string | undefined): object {
  if (!search || !key) return {};
  switch (key) {
    case 'id':          return { id: startsWithCi(search) };
    case 'buyerPhone':  return { buyer:  { phone: containsCi(search) } };
    case 'buyerName':   return { buyer:  { name:  containsCi(search) } };
    case 'sellerPhone': return { seller: { phone: containsCi(search) } };
    case 'sellerName':  return { seller: { name:  containsCi(search) } };
    default:            return {};
  }
}

/** Build a single-column search filter for /admin/team. */
function buildTeamSearchWhere(search: string | undefined, key: string | undefined): object {
  if (!search || !key) return {};
  switch (key) {
    case 'name':  return { name:  containsCi(search) };
    case 'email': return { email: containsCi(search) };
    default:      return {};
  }
}

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

    const totalOrders          = await this.prisma.order.count();
    const escrowActive         = await this.prisma.order.count({ where: { status: OrderStatus.ESCROW_ACTIVE } });
    const openDisputes         = await this.prisma.dispute.count({ where: { status: DisputeStatus.OPEN } });
    const disputesUnderReview  = await this.prisma.dispute.count({ where: { status: DisputeStatus.UNDER_REVIEW } });
    const totalCaptured        = await this.prisma.payment.aggregate({
      where: { status: PaymentStatus.CAPTURED },
      _sum: { amount: true }
    });
    const totalRefunded        = await this.prisma.payment.aggregate({
      where: { status: PaymentStatus.REFUNDED },
      _sum: { amount: true }
    });
    const refundsProcessing    = await this.prisma.payment.count({ where: { refundStatus: RefundStatus.PROCESSING } });
    const refundsFailed        = await this.prisma.payment.count({ where: { refundStatus: RefundStatus.FAILED } });
    const activeListings       = await this.prisma.voucherListing.count({ where: { status: 'ACTIVE' } });
    const totalUsers           = await this.prisma.user.count();

    return {
      orders: { total: totalOrders, escrowActive },
      disputes: { open: openDisputes, underReview: disputesUnderReview },
      payments: {
        totalCapturedInr: totalCaptured._sum.amount ?? 0,
        totalRefundedInr: totalRefunded._sum.amount ?? 0
      },
      refunds: { processing: refundsProcessing, failed: refundsFailed },
      listings: { active: activeListings },
      users: { total: totalUsers },
      generatedAt: new Date().toISOString()
    };
  }

  /** List disputes for admin triage. Paginated + searchable. */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Get(ADMIN_ROUTES.DISPUTES)
  async getDisputes(
    @Headers(adminHeaderName) adminToken?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('qBy') qBy?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    await this.adminAccessService.requireAdminAccess(adminToken);

    let statusFilter: DisputeStatus | undefined;
    if (status !== undefined) {
      if (!(status in DisputeStatus)) {
        throw new BadRequestException(
          `Invalid status '${status}'. Allowed: ${Object.values(DisputeStatus).join(', ')}.`
        );
      }
      statusFilter = DisputeStatus[status as keyof typeof DisputeStatus];
    }

    const search = normalizeSearch(q);
    const key = normalizeQBy(qBy);
    const { skip, take, page: p, pageSize: ps } = parsePagination(page, pageSize);

    const statusWhere = statusFilter
      ? { status: statusFilter }
      : { status: { in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW] } };

    const searchWhere = buildDisputeSearchWhere(search, key);
    const where = { AND: [statusWhere, searchWhere] };

    const data = await this.prisma.dispute.findMany({
      where,
      include: {
        order: {
          include: {
            listing: { include: { brand: true } },
            buyer: {
              select: {
                id: true, name: true, phone: true, email: true,
                tier: true, trustScore: true, status: true,
                disputeCount: true, totalSales: true, createdAt: true,
                buyerStrikes: true,
                _count: {
                  select: {
                    purchases: { where: { status: { not: OrderStatus.CANCELLED } } },
                    disputes: true
                  }
                }
              }
            },
            seller: {
              select: {
                id: true, name: true, phone: true, email: true,
                tier: true, trustScore: true, status: true,
                disputeCount: true, totalSales: true, createdAt: true,
                sellerStrikes: true, payoutHoldUntil: true,
                payoutAccount: { select: { kycStatus: true, upiId: true } }
              }
            },
            payment: true
          }
        },
        raisedBy: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take
    });
    const total = await this.prisma.dispute.count({ where });

    return { data, total, page: p, pageSize: ps };
  }


  /** List orders. Paginated + searchable. */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Get(ADMIN_ROUTES.ORDERS)
  async getOrders(
    @Headers(adminHeaderName) adminToken?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('qBy') qBy?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    await this.adminAccessService.requireAdminAccess(adminToken);

    const search = normalizeSearch(q);
    const key = normalizeQBy(qBy);
    const { skip, take, page: p, pageSize: ps } = parsePagination(page, pageSize);

    const statusWhere = status ? { status: status as OrderStatus } : {};
    const searchWhere = buildOrderSearchWhere(search, key);
    const where = { AND: [statusWhere, searchWhere] };

    const data = await this.prisma.order.findMany({
      where,
      include: {
        listing: { include: { brand: true } },
        buyer: { select: { id: true, name: true, phone: true } },
        seller: { select: { id: true, name: true, phone: true } },
        payment: true,
        dispute: true
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take
    });
    const total = await this.prisma.order.count({ where });

    return { data, total, page: p, pageSize: ps };
  }

  /** Single order with every related entity for the admin detail page. */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Get(ADMIN_ROUTES.ORDER_DETAIL)
  async getOrderDetail(
    @Param('id') id: string,
    @Headers(adminHeaderName) adminToken?: string
  ) {
    await this.adminAccessService.requireAdminAccess(adminToken);

    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        listing: {
          include: {
            brand: true,
            codeVault: {
              select: {
                id: true,
                codeHash: true,
                viewCount: true,
                firstViewedAt: true,
                lastViewedAt: true,
                createdAt: true
              }
            }
          }
        },
        buyer:  { select: { id: true, name: true, phone: true, email: true, tier: true, trustScore: true, status: true, disputeCount: true, buyerStrikes: true, sellerStrikes: true, createdAt: true } },
        seller: { select: { id: true, name: true, phone: true, email: true, tier: true, trustScore: true, status: true, disputeCount: true, buyerStrikes: true, sellerStrikes: true, payoutHoldUntil: true, totalSales: true, createdAt: true, payoutAccount: { select: { id: true, type: true, upiId: true, accountHolderName: true, kycStatus: true, verifiedAt: true, razorpayContactId: true, razorpayFundAccountId: true } } } },
        payment: true,
        dispute: { include: { raisedBy: { select: { id: true, name: true, phone: true } } } },
        notifications: { orderBy: { createdAt: 'asc' } }
      }
    });
    if (!order) throw new BadRequestException(`Order ${id} not found`);

    const auditLog = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: 'order',   entityId: order.id },
          { entityType: 'payment', entityId: order.payment?.id ?? '__none__' },
          { entityType: 'dispute', entityId: order.dispute?.id ?? '__none__' },
          { entityType: 'listing', entityId: order.listingId }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });

    return { ...order, auditLog };
  }

  /** List users. Paginated + searchable. */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Get(ADMIN_ROUTES.USERS)
  async getUsers(
    @Headers(adminHeaderName) adminToken?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('qBy') qBy?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    await this.adminAccessService.requireAdminAccess(adminToken);

    const search = normalizeSearch(q);
    const key = normalizeQBy(qBy);
    const { skip, take, page: p, pageSize: ps } = parsePagination(page, pageSize);

    const statusWhere = status ? { status: status as UserStatus } : {};
    const searchWhere = buildUserSearchWhere(search, key);
    const where = { AND: [statusWhere, searchWhere] };

    const data = await this.prisma.user.findMany({
      where,
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
        sellerStrikes: true,
        buyerStrikes: true,
        payoutHoldUntil: true,
        payoutAccount: { select: { kycStatus: true, upiId: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take
    });
    const total = await this.prisma.user.count({ where });

    return { data, total, page: p, pageSize: ps };
  }

  /** Clear a seller's payout hold (set after dispute strikes). After clearing, future payouts proceed normally. */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Post(ADMIN_ROUTES.USER_CLEAR_PAYOUT_HOLD)
  async clearPayoutHold(
    @Param('id') id: string,
    @Headers(adminHeaderName) adminToken?: string
  ) {
    await this.adminAccessService.requireAdminAccess(adminToken);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { payoutHoldUntil: null },
      select: { id: true, payoutHoldUntil: true }
    });

    await this.prisma.auditLog.create({
      data: {
        entityType: 'user',
        entityId: id,
        action: 'user.payout_hold_cleared',
        actorId: null,
        metadata: { clearedBy: 'admin' }
      }
    });

    return updated;
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
  async getPendingPayouts(
    @Headers(adminHeaderName) adminToken?: string,
    @Query('q') q?: string,
    @Query('qBy') qBy?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    await this.adminAccessService.requireAdminAccess(adminToken);

    const search = normalizeSearch(q);
    const key = normalizeQBy(qBy);
    const { skip, take, page: p, pageSize: ps } = parsePagination(page, pageSize);

    const baseWhere = {
      payment: {
        escrowStatus: EscrowStatus.RELEASED,
        payoutStatus: { in: [PayoutStatus.PENDING, PayoutStatus.FAILED] }
      }
    };
    const searchWhere = buildOrderPartySearchWhere(search, key);
    const where = { AND: [baseWhere, searchWhere] };

    const data = await this.prisma.order.findMany({
      where,
      include: {
        payment: true,
        buyer: { select: { id: true, name: true, phone: true } },
        seller: { select: { id: true, name: true, phone: true, payoutAccount: true } },
        listing: { include: { brand: true } }
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take
    });
    const total = await this.prisma.order.count({ where });

    return { data, total, page: p, pageSize: ps };
  }

  /**
   * Refunds that are stuck in PROCESSING (in-flight to Razorpay) or FAILED
   * (Razorpay error, no razorpayPaymentId, or expired-in-escrow with no auto-refund path).
   * These need admin attention — either retry via /orders/:id/retry-refund or
   * complete manually via /orders/:id/complete-refund after an out-of-band transfer.
   */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Get(ADMIN_ROUTES.REFUNDS_PENDING)
  async getPendingRefunds(
    @Headers(adminHeaderName) adminToken?: string,
    @Query('q') q?: string,
    @Query('qBy') qBy?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    await this.adminAccessService.requireAdminAccess(adminToken);

    const search = normalizeSearch(q);
    const key = normalizeQBy(qBy);
    const { skip, take, page: p, pageSize: ps } = parsePagination(page, pageSize);

    const baseWhere = {
      payment: { refundStatus: { in: [RefundStatus.PROCESSING, RefundStatus.FAILED] } }
    };
    const searchWhere = buildOrderPartySearchWhere(search, key);
    const where = { AND: [baseWhere, searchWhere] };

    const data = await this.prisma.order.findMany({
      where,
      include: {
        payment: true,
        buyer: { select: { id: true, name: true, phone: true } },
        seller: { select: { id: true, name: true, phone: true } },
        listing: { include: { brand: true } },
        dispute: true
      },
      orderBy: { updatedAt: 'asc' },
      skip,
      take
    });
    const total = await this.prisma.order.count({ where });

    return { data, total, page: p, pageSize: ps };
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
    if (!this.paymentsService.isRazorpayXEnabled()) {
      return { success: false, message: 'RazorpayX is not configured. Use complete-payout to mark as manually settled.' };
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

  /** List all admin users. Paginated + searchable. */
  @ApiHeader({ name: adminHeaderName, required: true })
  @Get(ADMIN_ROUTES.TEAM)
  async getTeam(
    @Headers(adminHeaderName) adminToken?: string,
    @Query('q') q?: string,
    @Query('qBy') qBy?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    await this.adminAccessService.requireSuperAdmin(adminToken);

    const search = normalizeSearch(q);
    const key = normalizeQBy(qBy);
    const { skip, take, page: p, pageSize: ps } = parsePagination(page, pageSize);

    const where = buildTeamSearchWhere(search, key);

    const data = await this.prisma.adminUser.findMany({
      where,
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      skip,
      take
    });
    const total = await this.prisma.adminUser.count({ where });

    return { data, total, page: p, pageSize: ps };
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
