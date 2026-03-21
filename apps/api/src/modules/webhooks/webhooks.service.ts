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

    if (event !== 'payment_link.paid') {
      this.logger.log(`Ignoring Razorpay event: ${event} (eventId=${eventId}).`);
      return;
    }

    const payload = (body as Record<string, unknown>).payload as Record<string, unknown> | undefined;
    const paymentLinkEntity = (payload?.payment_link as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;
    const paymentEntity = (payload?.payment as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;

    const paymentLinkId = paymentLinkEntity?.id;
    const razorpayPaymentId = typeof paymentEntity?.id === 'string' ? paymentEntity.id : undefined;

    if (typeof paymentLinkId !== 'string') {
      this.logger.warn(`payment_link.paid missing payment_link.entity.id (eventId=${eventId}).`);
      return;
    }

    this.logger.log(`Processing payment_link.paid: linkId=${paymentLinkId} eventId=${eventId}`);
    await this.ordersService.activateEscrowForPaymentLink(paymentLinkId, razorpayPaymentId);
  }
}
