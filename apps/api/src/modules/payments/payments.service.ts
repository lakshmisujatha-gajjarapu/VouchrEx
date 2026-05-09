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

import { PrismaService } from '../prisma/prisma.service';

type CheckoutOrder = {
  readonly id: string;
  readonly listingId: string;
  readonly buyerId: string;
  readonly amount: number;
  readonly platformFee: number;
};

export type CheckoutResult = {
  readonly razorpayOrderId: string;
  readonly amountPaise: number;
  readonly currency: string;
  readonly keyId: string;
};

type RazorpayContactResponse = { readonly id: string };
type RazorpayFundAccountResponse = { readonly id: string };
type RazorpayPayoutResponse = { readonly id: string; readonly status: string };
type RazorpayOrderResponse = { readonly id: string; readonly amount: number; readonly currency: string };
type RazorpayOrderPaymentsResponse = {
  readonly items: ReadonlyArray<{ readonly id: string; readonly status: string }>;
};

const razorpayBaseUrl = 'https://api.razorpay.com/v1';
const inrMinorUnitFactor = 100;
const defaultCurrency = 'INR';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async prepareCheckout(order: CheckoutOrder): Promise<CheckoutResult> {
    const totalAmount = order.amount + order.platformFee;

    const existingPayment = await this.prisma.payment.findUnique({
      where: { orderId: order.id }
    });

    if (existingPayment?.razorpayOrderId) {
      return this.buildCheckoutResult(existingPayment.razorpayOrderId, totalAmount);
    }

    const rzpOrder = await this.createRazorpayOrder(order.id, totalAmount);

    await this.prisma.payment.upsert({
      where: { orderId: order.id },
      update: {
        amount: totalAmount,
        method: 'pending',
        status: PaymentStatus.PENDING,
        escrowStatus: EscrowStatus.PENDING,
        currency: defaultCurrency,
        razorpayOrderId: rzpOrder.id
      },
      create: {
        orderId: order.id,
        amount: totalAmount,
        method: 'pending',
        status: PaymentStatus.PENDING,
        escrowStatus: EscrowStatus.PENDING,
        currency: defaultCurrency,
        razorpayOrderId: rzpOrder.id
      }
    });

    return this.buildCheckoutResult(rzpOrder.id, totalAmount);
  }

  verifySignature(input: {
    readonly orderId: string;
    readonly paymentId: string;
    readonly signature: string;
  }): boolean {
    const expectedSignature = createHmac('sha256', this.requireRazorpayKeySecret())
      .update(`${input.orderId}|${input.paymentId}`)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature);
    const receivedBuf = Buffer.from(input.signature);
    return expectedBuf.length === receivedBuf.length && timingSafeEqual(expectedBuf, receivedBuf);
  }

  /**
   * Initiate a Razorpay normal refund. Always pass `idempotencyKey` so retries
   * with the same DB attempt collapse at Razorpay (returns 200 with the original
   * refund) rather than charging twice.
   *
   * Header: `X-Refund-Idempotency` (min 10 chars, [a-zA-Z0-9_-] only).
   * Razorpay 409 responses indicate either an in-progress duplicate (retry safely)
   * or a conflicting request with the same key (different params) — both are surfaced
   * to the caller as a ServiceUnavailableException so the caller can decide.
   * @see https://razorpay.com/docs/api/refunds/normal-refunds-idempotent/
   */
  async executeRefund(
    razorpayPaymentId: string,
    amountInr: number,
    options: { idempotencyKey: string; orderId: string }
  ): Promise<{ razorpayRefundId: string | null }> {
    const response = await fetch(
      `${razorpayBaseUrl}/payments/${razorpayPaymentId}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: this.razorpayAuthHeader(),
          'Content-Type': 'application/json',
          'X-Refund-Idempotency': options.idempotencyKey
        },
        body: JSON.stringify({
          amount: amountInr * inrMinorUnitFactor,
          notes: { reason: 'dispute_refund', orderId: options.orderId },
          receipt: options.orderId
        })
      }
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new ServiceUnavailableException(
        `Razorpay refund failed with status ${String(response.status)}: ${errorBody}`
      );
    }

    const body = (await response.json().catch(() => ({}))) as { id?: string };
    this.logger.log(`Refund executed for payment ${razorpayPaymentId}, amount ₹${String(amountInr)} (refund ${body.id ?? 'unknown'}, key ${options.idempotencyKey})`);
    return { razorpayRefundId: body.id ?? null };
  }

  /**
   * Fetch all refunds Razorpay has on file for a payment. Used by reconciliation
   * to recover from crashes between "POST refund" returning and us persisting the
   * resulting refund ID.
   * @see https://razorpay.com/docs/api/refunds/fetch-multiple-refund-payment/
   */
  async fetchRefundsForPayment(razorpayPaymentId: string): Promise<ReadonlyArray<{
    readonly id: string;
    readonly status: 'pending' | 'processed' | 'failed';
    readonly amount: number;
    readonly notes: Record<string, string> | null;
  }>> {
    const response = await fetch(
      `${razorpayBaseUrl}/payments/${razorpayPaymentId}/refunds`,
      {
        method: 'GET',
        headers: { Authorization: this.razorpayAuthHeader() }
      }
    );

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Razorpay fetch refunds failed with status ${String(response.status)}.`
      );
    }

    const body = (await response.json()) as {
      items?: ReadonlyArray<{
        id: string;
        status: 'pending' | 'processed' | 'failed';
        amount: number;
        notes?: Record<string, string> | null;
      }>;
    };
    return (body.items ?? []).map((r) => ({
      id: r.id,
      status: r.status,
      amount: r.amount,
      notes: r.notes ?? null
    }));
  }

  async checkRazorpayOrderPaymentStatus(
    razorpayOrderId: string
  ): Promise<{ captured: boolean; razorpayPaymentId?: string }> {
    const response = await fetch(`${razorpayBaseUrl}/orders/${razorpayOrderId}/payments`, {
      headers: { Authorization: this.razorpayAuthHeader() }
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Razorpay order payments fetch failed with status ${String(response.status)}.`
      );
    }

    const raw = (await response.json()) as RazorpayOrderPaymentsResponse;
    const items: ReadonlyArray<{ readonly id: string; readonly status: string }> = Array.isArray(raw.items) ? raw.items : [];
    const capturedItem = items.find((p) => p.status === 'captured');

    return capturedItem
      ? { captured: true, razorpayPaymentId: capturedItem.id }
      : { captured: false };
  }

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
        bank_account: { name: accountHolderName, account_number: accountNumber, ifsc }
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

  private buildCheckoutResult(razorpayOrderId: string, totalAmountInr: number): CheckoutResult {
    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keyId) {
      throw new ServiceUnavailableException('RAZORPAY_KEY_ID is not configured.');
    }

    return {
      razorpayOrderId,
      amountPaise: totalAmountInr * inrMinorUnitFactor,
      currency: defaultCurrency,
      keyId
    };
  }

  private async createRazorpayOrder(internalOrderId: string, totalAmountInr: number): Promise<RazorpayOrderResponse> {
    const response = await fetch(razorpayBaseUrl + '/orders', {
      method: 'POST',
      headers: {
        Authorization: this.razorpayAuthHeader(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: totalAmountInr * inrMinorUnitFactor,
        currency: defaultCurrency,
        receipt: internalOrderId,
        notes: { appOrderId: internalOrderId }
      })
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Razorpay order creation failed with status ${String(response.status)}.`
      );
    }

    const payload = (await response.json()) as RazorpayOrderResponse;
    if (!payload.id) {
      throw new ServiceUnavailableException('Unexpected Razorpay order creation payload.');
    }

    return payload;
  }

  private requireRazorpayKeySecret(): string {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      throw new ServiceUnavailableException('RAZORPAY_KEY_SECRET is not configured.');
    }

    return keySecret;
  }

  private requireRazorpayXAccountNumber(): string {
    const accountNumber = process.env.RAZORPAY_X_ACCOUNT_NUMBER;
    if (!accountNumber) {
      throw new ServiceUnavailableException('RAZORPAY_X_ACCOUNT_NUMBER is not configured.');
    }

    return accountNumber;
  }

  isRazorpayXEnabled(): boolean {
    return !!(
      process.env.RAZORPAY_X_KEY_ID &&
      process.env.RAZORPAY_X_KEY_SECRET &&
      process.env.RAZORPAY_X_ACCOUNT_NUMBER
    );
  }

  private razorpayXAuthHeader(): string {
    const keyId = process.env.RAZORPAY_X_KEY_ID;
    const keySecret = process.env.RAZORPAY_X_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new ServiceUnavailableException('RAZORPAY_X_KEY_ID or RAZORPAY_X_KEY_SECRET is not configured.');
    }

    return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
  }

  private razorpayAuthHeader(): string {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new ServiceUnavailableException('RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not configured.');
    }

    return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
  }
}
