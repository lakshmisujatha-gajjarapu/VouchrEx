import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService
  ) {}

  verifySignature(rawBody: Buffer, signature: string): boolean {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      this.logger.warn('RAZORPAY_WEBHOOK_SECRET is not configured.');
      return false;
    }

    const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected);
    const receivedBuf = Buffer.from(signature);
    return expectedBuf.length === receivedBuf.length && timingSafeEqual(expectedBuf, receivedBuf);
  }

  async handleRazorpayEvent(body: unknown, eventId: string): Promise<void> {
    if (
      !body ||
      typeof body !== 'object' ||
      !('event' in body) ||
      typeof (body as Record<string, unknown>).event !== 'string'
    ) {
      this.logger.log(`Received malformed Razorpay webhook (eventId=${eventId}).`);
      return;
    }

    const event = (body as Record<string, unknown>).event as string;

    // Inbound idempotency. Razorpay retries non-2xx responses; without this row,
    // each replay re-runs all side effects (notifications, audit logs, state writes).
    try {
      await this.prisma.webhookEvent.create({
        data: {
          eventId,
          eventType: event,
          payload: body as Prisma.InputJsonValue
        }
      });
    } catch (e: unknown) {
      const code = (e as { code?: string } | null)?.code;
      if (code === 'P2002') {
        this.logger.log(`Webhook ${eventId} already received — skipping replay.`);
        return;
      }
      throw e;
    }

    try {
      if (event === 'payment.captured') {
        await this.handlePaymentCaptured(body as Record<string, unknown>, eventId);
      } else if (
        event === 'payout.processed' ||
        event === 'payout.failed' ||
        event === 'payout.reversed'
      ) {
        await this.handlePayoutEvent(body as Record<string, unknown>, event, eventId);
      } else if (
        event === 'refund.processed' ||
        event === 'refund.failed' ||
        event === 'refund.created'
      ) {
        const payload = (body as Record<string, unknown>).payload as Record<string, unknown> | undefined;
        const refundEntity = (payload?.refund as Record<string, unknown> | undefined)?.entity as
          | Record<string, unknown>
          | undefined;
        if (typeof refundEntity?.id !== 'string') {
          this.logger.warn(`${event} missing refund.entity.id (eventId=${eventId}).`);
        } else {
          const notes = (refundEntity.notes as { orderId?: string } | null | undefined) ?? null;
          await this.ordersService.handleRefundWebhook(notes, {
            id: refundEntity.id,
            status: typeof refundEntity.status === 'string' ? refundEntity.status : '',
            ...(typeof refundEntity.error_code === 'string' ? { error_code: refundEntity.error_code } : {}),
            ...(typeof refundEntity.error_description === 'string' ? { error_description: refundEntity.error_description } : {})
          });
        }
      } else {
        this.logger.log(`Ignoring Razorpay event: ${event} (eventId=${eventId}).`);
      }

      await this.prisma.webhookEvent.update({
        where: { eventId },
        data: { processedAt: new Date() }
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      // Deliberately do NOT delete the row on failure. Razorpay will retry and
      // the unique row will short-circuit the replay — preventing double-processing.
      // A stuck event requires admin intervention (clear the row, then replay).
      await this.prisma.webhookEvent.update({
        where: { eventId },
        data: { error: reason }
      });
      throw err;
    }
  }

  private async handlePaymentCaptured(body: Record<string, unknown>, eventId: string): Promise<void> {
    const payload = body.payload as Record<string, unknown> | undefined;
    const paymentEntity = (payload?.payment as Record<string, unknown> | undefined)?.entity as
      | Record<string, unknown>
      | undefined;

    const razorpayPaymentId = typeof paymentEntity?.id === 'string' ? paymentEntity.id : undefined;
    const razorpayOrderId =
      typeof paymentEntity?.order_id === 'string' ? paymentEntity.order_id : undefined;

    if (!razorpayPaymentId || !razorpayOrderId) {
      this.logger.warn(`payment.captured missing payment id or order_id (eventId=${eventId}).`);
      return;
    }

    this.logger.log(
      `Processing payment.captured: paymentId=${razorpayPaymentId} razorpayOrderId=${razorpayOrderId} eventId=${eventId}`
    );
    await this.ordersService.activateEscrowForOrder(razorpayOrderId, razorpayPaymentId);
  }

  private async handlePayoutEvent(
    body: Record<string, unknown>,
    event: 'payout.processed' | 'payout.failed' | 'payout.reversed',
    eventId: string
  ): Promise<void> {
    const payload = body.payload as Record<string, unknown> | undefined;
    const payoutEntity = (payload?.payout as Record<string, unknown> | undefined)?.entity as
      | Record<string, unknown>
      | undefined;
    const razorpayPayoutId =
      typeof payoutEntity?.id === 'string' ? payoutEntity.id : undefined;

    if (!razorpayPayoutId) {
      this.logger.warn(`${event} missing payout.entity.id (eventId=${eventId}).`);
      return;
    }

    this.logger.log(`Processing ${event}: payoutId=${razorpayPayoutId} eventId=${eventId}`);
    await this.ordersService.handlePayoutWebhook(razorpayPayoutId, event);
  }
}
