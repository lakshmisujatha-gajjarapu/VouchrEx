import {
  Injectable,
  Logger,
  ServiceUnavailableException
} from '@nestjs/common';
import {
  EscrowStatus,
  PaymentStatus
} from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';

type RazorpayContactResponse = { readonly id: string };
type RazorpayFundAccountResponse = { readonly id: string };
type RazorpayPayoutResponse = { readonly id: string; readonly status: string };

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

const razorpayBaseUrl = 'https://api.razorpay.com/v1';
const inrMinorUnitFactor = 100;
const defaultCurrency = 'INR';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async prepareCheckout(order: CheckoutOrder) {
    const totalAmount = order.amount + order.platformFee;

    const existingPayment = await this.prisma.payment.findUnique({
      where: { orderId: order.id }
    });

    if (existingPayment?.razorpayPaymentLinkId) {
      const link = await this.fetchPaymentLink(existingPayment.razorpayPaymentLinkId);
      return {
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
        currency: defaultCurrency,
        razorpayPaymentLinkId: link.id
      },
      create: {
        orderId: order.id,
        amount: totalAmount,
        method: 'pending',
        status: PaymentStatus.PENDING,
        escrowStatus: EscrowStatus.PENDING,
        currency: defaultCurrency,
        razorpayPaymentLinkId: link.id
      }
    });

    return {
      paymentLinkUrl: link.short_url,
      paymentLinkId: link.id
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
   * Called when a dispute is resolved in the buyer's favour.
   */
  async executeRefund(razorpayPaymentId: string, amountInr: number): Promise<void> {
    const response = await fetch(
      `${razorpayBaseUrl}/payments/${razorpayPaymentId}/refund`,
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

  /**
   * Create a Razorpay Contact for the seller.
   */
  async createRazorpayContact(name: string, phone: string): Promise<string> {
    const response = await fetch(razorpayBaseUrl + '/contacts', {
      method: 'POST',
      headers: {
        Authorization: this.razorpayXAuthHeader(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, contact: phone, type: 'vendor' })
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Razorpay contact creation failed with status ${String(response.status)}.`
      );
    }

    const payload = (await response.json()) as RazorpayContactResponse;
    return payload.id;
  }

  /**
   * Create a Razorpay Fund Account for a UPI VPA tied to a Contact.
   */
  async createRazorpayFundAccountUpi(contactId: string, upiId: string): Promise<string> {
    const response = await fetch(razorpayBaseUrl + '/fund_accounts', {
      method: 'POST',
      headers: {
        Authorization: this.razorpayXAuthHeader(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contact_id: contactId,
        account_type: 'vpa',
        vpa: { address: upiId }
      })
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Razorpay fund account creation failed with status ${String(response.status)}.`
      );
    }

    const payload = (await response.json()) as RazorpayFundAccountResponse;
    return payload.id;
  }

  /**
   * Create a Razorpay Fund Account for a bank account tied to a Contact.
   */
  async createRazorpayFundAccountBank(
    contactId: string,
    accountHolderName: string,
    accountNumber: string,
    ifsc: string
  ): Promise<string> {
    const response = await fetch(razorpayBaseUrl + '/fund_accounts', {
      method: 'POST',
      headers: {
        Authorization: this.razorpayXAuthHeader(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contact_id: contactId,
        account_type: 'bank_account',
        bank_account: {
          name: accountHolderName,
          account_number: accountNumber,
          ifsc
        }
      })
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Razorpay fund account (bank) creation failed with status ${String(response.status)}.`
      );
    }

    const payload = (await response.json()) as RazorpayFundAccountResponse;
    return payload.id;
  }

  /**
   * Trigger a RazorpayX Payout to a seller's registered fund account.
   * Returns the Razorpay payout ID (pout_xxxx).
   *
   * @param orderId  Used as idempotency key — safe to retry on network failure.
   * @param accountType  UPI → mode 'UPI', BANK_ACCOUNT → mode 'IMPS'.
   */
  async executePayout(
    fundAccountId: string,
    amountInr: number,
    orderId: string,
    accountType: 'UPI' | 'BANK_ACCOUNT'
  ): Promise<string> {
    const accountNumber = this.requireRazorpayXAccountNumber();
    const mode = accountType === 'UPI' ? 'UPI' : 'IMPS';

    const response = await fetch(razorpayBaseUrl + '/payouts', {
      method: 'POST',
      headers: {
        Authorization: this.razorpayXAuthHeader(),
        'Content-Type': 'application/json',
        'X-Payout-Idempotency': `payout_order_${orderId}`
      },
      body: JSON.stringify({
        account_number: accountNumber,
        fund_account_id: fundAccountId,
        amount: amountInr * inrMinorUnitFactor,
        currency: defaultCurrency,
        mode,
        purpose: 'payout',
        queue_if_low_balance: true
      })
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Razorpay payout failed with status ${String(response.status)}.`
      );
    }

    const payload = (await response.json()) as RazorpayPayoutResponse;
    this.logger.log(`Payout initiated: ${payload.id} status=${payload.status} amount=₹${String(amountInr)}`);
    return payload.id;
  }

  async checkPaymentLinkStatus(linkId: string): Promise<{ paid: boolean; razorpayPaymentId?: string }> {
    const response = await fetch(`${razorpayBaseUrl}/payment_links/${linkId}`, {
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
    const firstPayment = Array.isArray(payments) && payments.length > 0
      ? (payments[0] as Record<string, unknown>)
      : undefined;
    const razorpayPaymentId =
      typeof firstPayment?.razorpay_payment_id === 'string'
        ? firstPayment.razorpay_payment_id
        : undefined;

    return razorpayPaymentId !== undefined ? { paid, razorpayPaymentId } : { paid };
  }

  private requireRazorpayKeySecret() {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      throw new ServiceUnavailableException('RAZORPAY_KEY_SECRET is not configured.');
    }

    return keySecret;
  }

  private requireRazorpayXAccountNumber() {
    const accountNumber = process.env.RAZORPAY_X_ACCOUNT_NUMBER;
    if (!accountNumber) {
      throw new ServiceUnavailableException('RAZORPAY_X_ACCOUNT_NUMBER is not configured.');
    }

    return accountNumber;
  }

  private razorpayXAuthHeader() {
    const keyId = process.env.RAZORPAY_X_KEY_ID;
    const keySecret = process.env.RAZORPAY_X_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new ServiceUnavailableException('RAZORPAY_X_KEY_ID or RAZORPAY_X_KEY_SECRET is not configured.');
    }

    return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
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
    const response = await fetch(razorpayBaseUrl + '/payment_links', {
      method: 'POST',
      headers: {
        Authorization: this.razorpayAuthHeader(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: totalAmount * inrMinorUnitFactor,
        currency: defaultCurrency,
        reference_id: orderId,
        callback_url: process.env.RAZORPAY_PAYMENT_CALLBACK_URL ?? 'vouchrex://payment-callback',
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
    const response = await fetch(`${razorpayBaseUrl}/payment_links/${linkId}`, {
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
