import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderStatus, PaymentStatus } from '@prisma/client';

import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

const stalePaymentSyncMinutes = Number(process.env.STALE_PAYMENT_SYNC_MINUTES ?? 1);
const stalePaymentSyncMs = stalePaymentSyncMinutes * 60 * 1000;

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);
  private isRunning = false;

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
