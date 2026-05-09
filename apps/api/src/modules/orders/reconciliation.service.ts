import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderStatus, PaymentStatus, RefundStatus } from '@prisma/client';

import { ONE_MINUTE_MS } from '../../common/time.constants';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  STALE_PAYMENT_SYNC_MINUTES_DEFAULT,
  STUCK_REFUND_RECONCILE_MINUTES_DEFAULT
} from './orders.constants';
import { OrdersService } from './orders.service';

const stalePaymentSyncMinutes = Number(
  process.env.STALE_PAYMENT_SYNC_MINUTES ?? STALE_PAYMENT_SYNC_MINUTES_DEFAULT
);
const stalePaymentSyncMs = stalePaymentSyncMinutes * ONE_MINUTE_MS;

const stuckRefundMinutes = Number(
  process.env.STUCK_REFUND_RECONCILE_MINUTES ?? STUCK_REFUND_RECONCILE_MINUTES_DEFAULT
);
const stuckRefundMs = stuckRefundMinutes * ONE_MINUTE_MS;

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);
  private isRunning = false;
  private isRefundRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly ordersService: OrdersService
  ) {}

  @Cron('*/1 * * * *')
  async reconcileStalePayments() {
    if (this.isRunning) {
      this.logger.warn('reconcileStalePayments still running — skipping tick.');
      return;
    }
    this.isRunning = true;
    try {
      await this.runReconciliation();
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Recover Payment rows stuck in refundStatus=PROCESSING. This happens when a
   * Razorpay refund POST succeeded but our process crashed (or the network died)
   * before we could persist the resulting refund ID.
   *
   * For each stuck row we GET /v1/payments/:id/refunds and reconcile by:
   *  - matching `notes.orderId` (we set this on every refund we initiate);
   *  - falling back to the most recent refund on the payment if `notes` is missing
   *    (legacy refunds before this change).
   *
   * Razorpay refund states: pending | processed | failed.
   * Money-side invariant: we never flip payment.status=REFUNDED until Razorpay
   * reports `processed`.
   */
  @Cron('*/5 * * * *')
  async reconcileStuckRefunds() {
    if (this.isRefundRunning) {
      this.logger.warn('reconcileStuckRefunds still running — skipping tick.');
      return;
    }
    this.isRefundRunning = true;
    try {
      await this.runRefundReconciliation();
    } catch (error) {
      this.logger.error(
        `reconcileStuckRefunds failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      this.isRefundRunning = false;
    }
  }

  private async runRefundReconciliation() {
    const cutoff = new Date(Date.now() - stuckRefundMs);

    const stuck = await this.prisma.payment.findMany({
      where: {
        refundStatus: RefundStatus.PROCESSING,
        refundInitiatedAt: { lte: cutoff },
        razorpayPaymentId: { not: null }
      },
      select: {
        id: true,
        orderId: true,
        razorpayPaymentId: true,
        amount: true,
        razorpayRefundId: true
      }
    });

    if (stuck.length === 0) return;

    this.logger.warn(`Reconciling ${String(stuck.length)} stuck PROCESSING refund(s).`);

    for (const payment of stuck) {
      if (!payment.razorpayPaymentId) continue;
      try {
        const refunds = await this.paymentsService.fetchRefundsForPayment(payment.razorpayPaymentId);

        // Prefer the refund whose notes.orderId matches; otherwise the most recent
        // refund on the payment (Razorpay returns newest-first by default).
        const matched =
          refunds.find((r) => r.notes?.orderId === payment.orderId) ?? refunds[0];

        if (!matched) {
          this.logger.warn(
            `No Razorpay refund found for orderId=${payment.orderId} payment=${payment.razorpayPaymentId}; leaving as PROCESSING.`
          );
          continue;
        }

        if (matched.status === 'processed') {
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.REFUNDED,
              refundStatus: RefundStatus.COMPLETED,
              refundCompletedAt: new Date(),
              razorpayRefundId: matched.id
            }
          });
          await this.prisma.auditLog.create({
            data: {
              entityType: 'payment',
              entityId: payment.id,
              action: 'payment.refund_reconciled_completed',
              actorId: null,
              metadata: { orderId: payment.orderId, razorpayRefundId: matched.id }
            }
          });
          this.logger.log(`Refund reconciled COMPLETED: order=${payment.orderId} refund=${matched.id}`);
        } else if (matched.status === 'failed') {
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              refundStatus: RefundStatus.FAILED,
              refundFailureReason: 'Razorpay reported refund failed (reconciled).',
              razorpayRefundId: matched.id
            }
          });
          await this.prisma.auditLog.create({
            data: {
              entityType: 'payment',
              entityId: payment.id,
              action: 'payment.refund_reconciled_failed',
              actorId: null,
              metadata: { orderId: payment.orderId, razorpayRefundId: matched.id }
            }
          });
          this.logger.warn(`Refund reconciled FAILED: order=${payment.orderId} refund=${matched.id}`);
        } else {
          // status === 'pending' — store the refund ID if we don't have it,
          // but leave PROCESSING so we check again next tick.
          if (!payment.razorpayRefundId) {
            await this.prisma.payment.update({
              where: { id: payment.id },
              data: { razorpayRefundId: matched.id }
            });
          }
        }
      } catch (error) {
        this.logger.error(
          `Refund reconciliation failed for order ${payment.orderId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  private async runReconciliation() {
    const stalePaymentCutoff = new Date(Date.now() - stalePaymentSyncMs);

    const stalePendingPayments = await this.prisma.payment.findMany({
      where: {
        razorpayOrderId: { not: null },
        status: PaymentStatus.PENDING,
        order: { status: OrderStatus.PAYMENT_PENDING },
        createdAt: { lte: stalePaymentCutoff }
      },
      include: { order: true }
    });

    if (stalePendingPayments.length === 0) return;

    this.logger.log(`Reconciling ${String(stalePendingPayments.length)} stale PAYMENT_PENDING orders.`);

    for (const payment of stalePendingPayments) {
      if (!payment.razorpayOrderId) continue;
      try {
        const { captured, razorpayPaymentId } =
          await this.paymentsService.checkRazorpayOrderPaymentStatus(payment.razorpayOrderId);

        if (captured) {
          this.logger.log(`Reconciliation: activating escrow for order ${payment.orderId}.`);
          await this.ordersService.activateEscrowForOrder(payment.razorpayOrderId, razorpayPaymentId);
        }
      } catch (error) {
        this.logger.error(
          `Reconciliation failed for order ${payment.orderId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }
}
