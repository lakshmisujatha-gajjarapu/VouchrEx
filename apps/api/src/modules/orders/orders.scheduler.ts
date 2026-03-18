import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { OrdersService } from './orders.service';

const rawTimeout = Number(process.env.PAYMENT_TIMEOUT_MINUTES);
const paymentTimeoutMinutes = Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 30;

@Injectable()
export class OrdersScheduler {
  private readonly logger = new Logger(OrdersScheduler.name);

  private autoConfirmRunning = false;
  private cancelStaleRunning = false;
  private expiredEscrowRunning = false;
  private reminderRunning = false;
  private recoveryRunning = false;

  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Auto-confirm CODE_REVEALED orders whose verification window has ended.
   * Runs every minute. Idempotent — safe to re-run.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleAutoConfirm() {
    if (this.autoConfirmRunning) {
      this.logger.warn('handleAutoConfirm still running — skipping tick.');
      return;
    }
    this.autoConfirmRunning = true;
    try {
      const processed = await this.ordersService.autoConfirmExpiredOrders();
      if (processed > 0) {
        this.logger.log(`Auto-confirmed ${String(processed)} order(s).`);
      }
    } catch (error) {
      this.logger.error(`handleAutoConfirm failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.autoConfirmRunning = false;
    }
  }

  /**
   * Cancel PAYMENT_PENDING orders where the buyer never completed payment.
   * Releases the listing back to ACTIVE. Runs every 5 minutes.
   * Timeout window is PAYMENT_TIMEOUT_MINUTES (default 30).
   */
  @Cron('*/5 * * * *')
  async handleCancelStalePayments() {
    if (this.cancelStaleRunning) {
      this.logger.warn('handleCancelStalePayments still running — skipping tick.');
      return;
    }
    this.cancelStaleRunning = true;
    try {
      const cancelled = await this.ordersService.cancelStalePaymentPendingOrders(paymentTimeoutMinutes);
      if (cancelled > 0) {
        this.logger.log(
          `Cancelled ${String(cancelled)} stale PAYMENT_PENDING order(s) (timeout=${String(paymentTimeoutMinutes)}m).`
        );
      }
    } catch (error) {
      this.logger.error(`handleCancelStalePayments failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.cancelStaleRunning = false;
    }
  }

  /**
   * HLD Scenario 4: cancel orders where the voucher expired while escrow was active.
   * Marks payment REFUNDED (pending manual payout). No seller strike.
   * Runs every 30 minutes.
   */
  @Cron('*/30 * * * *')
  async handleExpiredEscrowOrders() {
    if (this.expiredEscrowRunning) {
      this.logger.warn('handleExpiredEscrowOrders still running — skipping tick.');
      return;
    }
    this.expiredEscrowRunning = true;
    try {
      const cancelled = await this.ordersService.cancelExpiredEscrowOrders();
      if (cancelled > 0) {
        this.logger.log(`Cancelled ${String(cancelled)} order(s) with expired vouchers in escrow.`);
      }
    } catch (error) {
      this.logger.error(`handleExpiredEscrowOrders failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.expiredEscrowRunning = false;
    }
  }

  /**
   * Send verification deadline reminders to buyers at 60min, 30min, 5min marks.
   * Prevents surprise auto-confirms. Runs every 2 minutes for precision.
   */
  @Cron('*/2 * * * *')
  async handleVerificationReminders() {
    if (this.reminderRunning) {
      this.logger.warn('handleVerificationReminders still running — skipping tick.');
      return;
    }
    this.reminderRunning = true;
    try {
      const sent = await this.ordersService.sendVerificationReminders();
      if (sent > 0) {
        this.logger.log(`Sent ${String(sent)} verification reminder(s).`);
      }
    } catch (error) {
      this.logger.error(`handleVerificationReminders failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.reminderRunning = false;
    }
  }

  /**
   * HLD Scenario 2: recover CODE_REVEALED orders with NULL verificationDeadline.
   * Runs every 10 minutes. Should be rare after initial stabilisation.
   */
  @Cron('*/10 * * * *')
  async handleDeadlineRecovery() {
    if (this.recoveryRunning) return;
    this.recoveryRunning = true;
    try {
      const recovered = await this.ordersService.recoverMissingDeadlines();
      if (recovered > 0) {
        this.logger.warn(`Recovered ${String(recovered)} order(s) with missing verificationDeadline.`);
      }
    } catch (error) {
      this.logger.error(`handleDeadlineRecovery failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.recoveryRunning = false;
    }
  }
}
