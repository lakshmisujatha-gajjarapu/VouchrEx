import {
  Injectable,
  Logger,
  ServiceUnavailableException
} from '@nestjs/common';
import {
  EscrowStatus,
  PaymentProvider,
  PaymentStatus
} from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';

type CheckoutOrder = {
  readonly id: string;
  readonly listingId: string;
  readonly buyerId: string;
  readonly amount: number;
  readonly platformFee: number;
};

type RazorpayPaymentLinkResponse = {
  readonly id: string;
  readonly short_url: string;
};

const inrMinorUnitFactor = 100;
const defaultCurrency = 'INR';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  getConfiguredProvider() {
    return this.resolveProvider();
  }

  async prepareCheckout(order: CheckoutOrder) {
    const totalAmount = order.amount + order.platformFee;
    const provider = this.resolveProvider();

    if (provider === PaymentProvider.RAZORPAY) {
      const existingPayment = await this.prisma.payment.findUnique({
        where: { orderId: order.id }
      });

      if (existingPayment?.razorpayPaymentLinkId) {
        const link = await this.fetchPaymentLink(existingPayment.razorpayPaymentLinkId);
        return {
          provider,
          paymentLinkUrl: link.short_url,
          paymentLinkId: link.id
        };
      }

      const link = await this.createRazorpayPaymentLink(order.id, totalAmount, order);

      await this.prisma.payment.upsert({
        where: { orderId: order.id },
        update: {
          amount: totalAmount,
          method: 'pending',
          status: PaymentStatus.PENDING,
          escrowStatus: EscrowStatus.PENDING,
          provider,
          currency: defaultCurrency,
          razorpayPaymentLinkId: link.id
        },
        create: {
          orderId: order.id,
          amount: totalAmount,
          method: 'pending',
          status: PaymentStatus.PENDING,
          escrowStatus: EscrowStatus.PENDING,
          provider,
          currency: defaultCurrency,
          razorpayPaymentLinkId: link.id
        }
      });

      return {
        provider,
        paymentLinkUrl: link.short_url,
        paymentLinkId: link.id
      };
    }

    await this.prisma.payment.upsert({
      where: { orderId: order.id },
      update: {
        amount: totalAmount,
        method: 'mock',
        status: PaymentStatus.PENDING,
        escrowStatus: EscrowStatus.PENDING,
        provider,
        currency: defaultCurrency
      },
      create: {
        orderId: order.id,
        amount: totalAmount,
        method: 'mock',
        status: PaymentStatus.PENDING,
        escrowStatus: EscrowStatus.PENDING,
        provider,
        currency: defaultCurrency
      }
    });

    return {
      provider,
      orderId: `mock_${order.id}`,
      amount: totalAmount * inrMinorUnitFactor,
      currency: defaultCurrency,
      receipt: order.id
    };
  }

  verifySignature(input: {
    readonly orderId: string;
    readonly paymentId: string;
    readonly signature: string;
  }) {
    const expectedSignature = createHmac('sha256', this.requireRazorpayKeySecret())
      .update(`${input.orderId}|${input.paymentId}`)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature);
    const receivedBuf = Buffer.from(input.signature);
    return expectedBuf.length === receivedBuf.length && timingSafeEqual(expectedBuf, receivedBuf);
  }

  /**
   * Execute a real refund via Razorpay API.
   * For MOCK provider, logs and skips the API call.
   * Called when a dispute is resolved in the buyer's favour.
   */
  async executeRefund(razorpayPaymentId: string, amountInr: number): Promise<void> {
    if (this.resolveProvider() !== PaymentProvider.RAZORPAY) {
      this.logger.log(`MOCK: skipping refund for payment ${razorpayPaymentId}, amount ₹${String(amountInr)}`);
      return;
    }

    const response = await fetch(
      `https://api.razorpay.com/v1/payments/${razorpayPaymentId}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: this.razorpayAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amountInr * inrMinorUnitFactor,
          notes: { reason: 'dispute_refund' }
        })
      }
    );

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Razorpay refund failed with status ${String(response.status)}.`
      );
    }

    this.logger.log(`Refund executed for payment ${razorpayPaymentId}, amount ₹${String(amountInr)}`);
  }

  async checkPaymentLinkStatus(linkId: string): Promise<{ paid: boolean; razorpayPaymentId?: string }> {
    const response = await fetch(`https://api.razorpay.com/v1/payment_links/${linkId}`, {
      headers: { Authorization: this.razorpayAuthHeader() }
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Razorpay payment link fetch failed with status ${String(response.status)}.`
      );
    }

    const payload: unknown = await response.json();

    if (!payload || typeof payload !== 'object') {
      throw new ServiceUnavailableException('Unexpected Razorpay payment link payload.');
    }

    const body = payload as Record<string, unknown>;
    const paid = body.status === 'paid';
    const payments = body.payments as readonly Record<string, unknown>[] | undefined;
    const razorpayPaymentId =
      Array.isArray(payments) && payments.length > 0 && typeof payments[0]?.razorpay_payment_id === 'string'
        ? (payments[0].razorpay_payment_id as string)
        : undefined;

    return razorpayPaymentId !== undefined ? { paid, razorpayPaymentId } : { paid };
  }

  private resolveProvider() {
    const configuredProvider = (process.env.PAYMENT_PROVIDER ?? '').trim().toUpperCase();

    if (!configuredProvider) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException(
          'PAYMENT_PROVIDER must be explicitly configured in production.'
        );
      }

      return PaymentProvider.MOCK;
    }

    if (configuredProvider === 'MOCK') {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException(
          'PAYMENT_PROVIDER=MOCK is not allowed in production. Use RAZORPAY.'
        );
      }

      return PaymentProvider.MOCK;
    }

    if (configuredProvider === 'RAZORPAY') {
      return PaymentProvider.RAZORPAY;
    }

    throw new ServiceUnavailableException(
      `Unsupported PAYMENT_PROVIDER ${configuredProvider}.`
    );
  }

  private requireRazorpayKeySecret() {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      throw new ServiceUnavailableException('RAZORPAY_KEY_SECRET is not configured.');
    }

    return keySecret;
  }

  private razorpayAuthHeader() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new ServiceUnavailableException('RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not configured.');
    }

    return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
  }

  private async createRazorpayPaymentLink(
    orderId: string,
    totalAmount: number,
    order: CheckoutOrder
  ): Promise<RazorpayPaymentLinkResponse> {
    const response = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        Authorization: this.razorpayAuthHeader(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: totalAmount * inrMinorUnitFactor,
        currency: defaultCurrency,
        reference_id: orderId,
        callback_url: 'couponbazaar://payment-callback',
        callback_method: 'get',
        notes: {
          appOrderId: order.id,
          listingId: order.listingId,
          buyerId: order.buyerId
        }
      })
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Razorpay payment link creation failed with status ${String(response.status)}.`
      );
    }

    const payload: unknown = await response.json();
    return this.parsePaymentLinkResponse(payload);
  }

  private async fetchPaymentLink(linkId: string): Promise<RazorpayPaymentLinkResponse> {
    const response = await fetch(`https://api.razorpay.com/v1/payment_links/${linkId}`, {
      headers: { Authorization: this.razorpayAuthHeader() }
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Razorpay payment link fetch failed with status ${String(response.status)}.`
      );
    }

    const payload: unknown = await response.json();
    return this.parsePaymentLinkResponse(payload);
  }

  private parsePaymentLinkResponse(payload: unknown): RazorpayPaymentLinkResponse {
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('id' in payload) ||
      !('short_url' in payload) ||
      typeof payload.id !== 'string' ||
      typeof payload.short_url !== 'string'
    ) {
      throw new ServiceUnavailableException('Unexpected Razorpay payment link payload.');
    }

    return { id: payload.id, short_url: payload.short_url };
  }
}
