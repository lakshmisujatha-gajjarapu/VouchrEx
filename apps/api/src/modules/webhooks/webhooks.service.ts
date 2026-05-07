import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { OrdersService } from '../orders/orders.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly ordersService: OrdersService) {}

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

    if (event === 'payment.captured') {
      await this.handlePaymentCaptured(body as Record<string, unknown>, eventId);
      return;
    }

    if (event === 'payout.processed' || event === 'payout.failed' || event === 'payout.reversed') {
      await this.handlePayoutEvent(body as Record<string, unknown>, event, eventId);
      return;
    }

    this.logger.log(`Ignoring Razorpay event: ${event} (eventId=${eventId}).`);
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
