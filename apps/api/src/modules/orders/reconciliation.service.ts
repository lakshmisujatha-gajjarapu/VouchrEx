import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderStatus, PaymentStatus, PayoutStatus, RefundStatus } from '@prisma/client';

import { ONE_MINUTE_MS } from '../../common/time.constants';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  MAX_AUTO_REFUND_RETRY_ATTEMPTS,
  STALE_PAYMENT_SYNC_MINUTES_DEFAULT,
  STUCK_PAYOUT_RECONCILE_MINUTES_DEFAULT,
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

const stuckPayoutMinutes = Number(
  process.env.STUCK_PAYOUT_RECONCILE_MINUTES ?? STUCK_PAYOUT_RECONCILE_MINUTES_DEFAULT
);
const stuckPayoutMs = stuckPayoutMinutes * ONE_MINUTE_MS;

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);
  private isRunning = false;
  private isRefundRunning = false;
  private isPayoutRunning = false;

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
      await this.runFailedRefundRetry();
    } catch (error) {
      this.logger.error(
        `reconcileStuckRefunds failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      this.isRefundRunning = false;
    }
  }

  /**
   * Recover Payment rows stuck in payoutStatus=PROCESSING. This happens when a
   * RazorpayX payout POST succeeded but our process crashed (or the network died)
   * before we could persist the resulting status update.
   *
   * For each stuck row we GET /v1/payouts/:id and reconcile by:
   *  - `processed` → COMPLETED;
   *  - `failed` → FAILED;
   *  - anything else → leave as PROCESSING, check again next tick.
   */
  @Cron('*/5 * * * *')
  async reconcileStuckPayouts() {
    if (this.isPayoutRunning) {
      this.logger.warn('reconcileStuckPayouts still running — skipping tick.');
      return;
    }
    this.isPayoutRunning = true;
    try {
      await this.runPayoutReconciliation();
    } catch (error) {
      this.logger.error(
        `reconcileStuckPayouts failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      this.isPayoutRunning = false;
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

  private async runPayoutReconciliation() {
    const cutoff = new Date(Date.now() - stuckPayoutMs);

    const stuck = await this.prisma.payment.findMany({
      where: {
        payoutStatus: PayoutStatus.PROCESSING,
        payoutInitiatedAt: { lte: cutoff },
        razorpayPayoutId: { not: null }
      },
      select: {
        id: true,
        orderId: true,
        razorpayPayoutId: true
      }
    });

    if (stuck.length === 0) return;

    this.logger.warn(`Reconciling ${String(stuck.length)} stuck PROCESSING payout(s).`);

    for (const payment of stuck) {
      if (!payment.razorpayPayoutId) continue;
      try {
        const remote = await this.paymentsService.fetchPayoutById(payment.razorpayPayoutId);

        if (remote.status === 'processed') {
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              payoutStatus: PayoutStatus.COMPLETED,
              payoutCompletedAt: new Date()
            }
          });
          await this.prisma.auditLog.create({
            data: {
              entityType: 'payment',
              entityId: payment.id,
              action: 'payment.payout_reconciled_completed',
              actorId: null,
              metadata: { orderId: payment.orderId, razorpayPayoutId: payment.razorpayPayoutId, remoteStatus: remote.status }
            }
          });
          this.logger.log(`Payout reconciled COMPLETED: order=${payment.orderId} payout=${payment.razorpayPayoutId}`);
        } else if (remote.status === 'failed' || remote.status === 'reversed') {
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              payoutStatus: PayoutStatus.FAILED,
              payoutFailureReason: remote.failure_reason ?? remote.status
            }
          });
          await this.prisma.auditLog.create({
            data: {
              entityType: 'payment',
              entityId: payment.id,
              action: 'payment.payout_reconciled_failed',
              actorId: null,
              metadata: {
                orderId: payment.orderId,
                razorpayPayoutId: payment.razorpayPayoutId,
                remoteStatus: remote.status,
                reason: remote.failure_reason
              }
            }
          });
          this.logger.warn(`Payout reconciled FAILED: order=${payment.orderId} payout=${payment.razorpayPayoutId} reason=${remote.failure_reason ?? remote.status}`);
        }
        // else: still in flight at RazorpayX (queued/pending) — leave as PROCESSING
      } catch (error) {
        this.logger.error(
          `Payout reconciliation failed for order ${payment.orderId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Retry payments whose refundStatus=FAILED. This is the automated counterpart to
   * the admin's retryDisputeRefund endpoint.
   *
   * Race-condition safety: before any Razorpay call or side-effecting DB write we
   * atomically claim the row by transitioning FAILED → PROCESSING via updateMany.
   * If another process (admin retry or a concurrent reconciliation tick) already
   * claimed the row, updateMany returns count=0 and we skip — no double-refund.
   */
  private async runFailedRefundRetry() {
    const cutoff = new Date(Date.now() - stuckRefundMs);

    const failed = await this.prisma.payment.findMany({
      where: {
        refundStatus: RefundStatus.FAILED,
        refundInitiatedAt: { lte: cutoff },
        razorpayPaymentId: { not: null },
        refundAttempts: { lt: MAX_AUTO_REFUND_RETRY_ATTEMPTS }
      },
      select: {
        id: true,
        orderId: true,
        razorpayPaymentId: true,
        amount: true,
        refundAttempts: true
      }
    });

    if (failed.length === 0) return;

    this.logger.warn(`Retrying ${String(failed.length)} FAILED refund(s).`);

    for (const p of failed) {
      if (!p.razorpayPaymentId) continue;
      try {
        // Atomic claim: transition FAILED → PROCESSING only if the row is still FAILED.
        // If count=0, another process (admin retry / parallel recon tick) already owns it.
        const claim = await this.prisma.payment.updateMany({
          where: { orderId: p.orderId, refundStatus: RefundStatus.FAILED },
          data: { refundStatus: RefundStatus.PROCESSING, refundInitiatedAt: new Date() }
        });
        if (claim.count === 0) {
          this.logger.log(
            `Refund reconciliation skipping ${p.orderId}: another process claimed it.`
          );
          continue;
        }

        // Defense in depth: check Razorpay for a refund that already succeeded but
        // whose DB write was lost (network blip between Razorpay 200 and our update).
        const existingRefunds = await this.paymentsService.fetchRefundsForPayment(
          p.razorpayPaymentId
        );
        const ours = existingRefunds.find(
          (r) =>
            r.notes != null && r.notes['orderId'] === p.orderId &&
            (r.status === 'processed' || r.status === 'pending')
        );

        if (ours) {
          await this.prisma.payment.update({
            where: { orderId: p.orderId },
            data: {
              refundStatus:
                ours.status === 'processed' ? RefundStatus.COMPLETED : RefundStatus.PROCESSING,
              razorpayRefundId: ours.id,
              refundFailureReason: null
            }
          });
          await this.prisma.auditLog.create({
            data: {
              entityType: 'payment',
              entityId: p.id,
              action: 'payment.refund_recovered_from_razorpay',
              actorId: null,
              metadata: { orderId: p.orderId, razorpayRefundId: ours.id, razorpayStatus: ours.status }
            }
          });
          this.logger.log(
            `Refund reconciliation recovered from Razorpay: order=${p.orderId} refund=${ours.id} status=${ours.status}`
          );
          continue;
        }

        // No existing refund found — issue a new one.
        const idempotencyKey = `refund-${p.orderId}`;
        try {
          const { razorpayRefundId } = await this.paymentsService.executeRefund(
            p.razorpayPaymentId,
            p.amount,
            { idempotencyKey, orderId: p.orderId }
          );
          await this.prisma.payment.update({
            where: { orderId: p.orderId },
            data: {
              refundStatus: RefundStatus.COMPLETED,
              refundCompletedAt: new Date(),
              razorpayRefundId,
              refundFailureReason: null
            }
          });
          await this.prisma.auditLog.create({
            data: {
              entityType: 'payment',
              entityId: p.id,
              action: 'payment.refund_retried_completed',
              actorId: null,
              metadata: { orderId: p.orderId, razorpayRefundId }
            }
          });
          this.logger.log(`Refund retry COMPLETED: order=${p.orderId} refund=${razorpayRefundId ?? 'unknown'}`);
        } catch (refundError) {
          const reason = refundError instanceof Error ? refundError.message : String(refundError);
          this.logger.error(`Refund retry failed for order ${p.orderId}: ${reason}`);
          await this.prisma.payment.update({
            where: { orderId: p.orderId },
            data: {
              refundStatus: RefundStatus.FAILED,
              refundFailureReason: reason,
              refundAttempts: { increment: 1 }
            }
          });
          await this.prisma.auditLog.create({
            data: {
              entityType: 'payment',
              entityId: p.id,
              action: 'payment.refund_retry_failed',
              actorId: null,
              metadata: { orderId: p.orderId, reason }
            }
          });
        }
      } catch (error) {
        this.logger.error(
          `Refund retry reconciliation failed for order ${p.orderId}: ${error instanceof Error ? error.message : String(error)}`
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
