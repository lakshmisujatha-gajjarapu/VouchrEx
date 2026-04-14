import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DisputeResolution,
  DisputeStatus,
  EscrowStatus,
  ListingStatus,
  NotificationChannel,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  PayoutStatus,
  UserStatus
} from '@prisma/client';

import { CodeVaultService } from '../listings/services/code-vault.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  commissionRate,
  highValueThresholdInr,
  highValueWindowHours,
  platformFeeInr
} from './orders.constants';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly codeVaultService: CodeVaultService,
    private readonly notificationsService: NotificationsService,
    private readonly paymentsService: PaymentsService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  findAllForUser(userId: string) {
    return this.prisma.order.findMany({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }]
      },
      include: {
        listing: {
          include: {
            brand: true
          }
        },
        buyer: {
          select: { id: true, name: true, phone: true }
        },
        seller: {
          select: { id: true, name: true, phone: true }
        },
        payment: true,
        dispute: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOneForUser(id: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id,
        OR: [{ buyerId: userId }, { sellerId: userId }]
      },
      include: {
        listing: {
          include: {
            brand: true,
            seller: {
              select: { id: true, name: true }
            }
          }
        },
        buyer: {
          select: { id: true, name: true, phone: true }
        },
        seller: {
          select: { id: true, name: true, phone: true }
        },
        payment: true,
        dispute: true
      }
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} was not found.`);
    }

    return order;
  }

  async create(
    createOrderDto: CreateOrderDto,
    buyer: {
      readonly id: string;
      readonly name: string;
      readonly phone: string;
      readonly tier: string;
    }
  ) {
    const listing = await this.prisma.voucherListing.findUnique({
      where: { id: createOrderDto.listingId },
      include: {
        brand: true,
        seller: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        }
      }
    });

    if (!listing) {
      throw new NotFoundException(`Listing ${createOrderDto.listingId} was not found.`);
    }

    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('Only active listings can be reserved.');
    }

    if (listing.expiryDate <= new Date()) {
      throw new BadRequestException('Expired listings cannot be ordered.');
    }

    if (listing.sellerId === buyer.id) {
      throw new BadRequestException('Sellers cannot buy their own listing.');
    }

    // Buyer velocity: max 3 orders per hour (HLD fraud rule B1)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentBuyerOrders = await this.prisma.order.count({
      where: {
        buyerId: buyer.id,
        createdAt: { gte: oneHourAgo },
        status: { not: OrderStatus.CANCELLED }
      }
    });
    const buyerMaxOrdersPerHour = Number(process.env.BUYER_MAX_ORDERS_PER_HOUR ?? 3);
    if (recentBuyerOrders >= buyerMaxOrdersPerHour) {
      throw new BadRequestException('Too many purchases in a short period. Please try again later.');
    }

    // Bronze users cannot purchase high-value vouchers (HLD fraud rule B5 / trust tier gating)
    if (buyer.tier === 'BRONZE' && listing.sellingPrice > highValueThresholdInr) {
      throw new BadRequestException(
        'New accounts cannot purchase high-value vouchers. Complete more transactions to raise your trust tier.'
      );
    }

    const platformFee = platformFeeInr;
    const commission = Math.round(listing.sellingPrice * commissionRate);
    const sellerPayout = listing.sellingPrice - commission;

    const order = await this.prisma.$transaction(async (tx) => {
      // Remove stale terminal orders so the unique constraint on listingId
      // doesn't block a fresh purchase attempt after a cancelled payment.
      await tx.order.deleteMany({
        where: {
          listingId: listing.id,
          status: { in: [OrderStatus.CANCELLED, OrderStatus.PAYMENT_FAILED] }
        }
      });

      const createdOrder = await tx.order.create({
        data: {
          listingId: listing.id,
          buyerId: buyer.id,
          sellerId: listing.sellerId,
          amount: listing.sellingPrice,
          platformFee,
          commission,
          sellerPayout,
          status: OrderStatus.PAYMENT_PENDING
        },
        include: {
          listing: {
            include: {
              brand: true
            }
          }
        }
      });

      await tx.voucherListing.update({
        where: { id: listing.id },
        data: {
          status: ListingStatus.RESERVED,
          buyerId: buyer.id
        }
      });

      await tx.auditLog.create({
        data: {
          entityType: 'order',
          entityId: createdOrder.id,
          action: 'order.initiated',
          actorId: buyer.id,
          metadata: {
            listingId: listing.id
          }
        }
      });

      return createdOrder;
    });

    try {
      const checkout = await this.paymentsService.prepareCheckout({
        id: order.id,
        listingId: order.listingId,
        buyerId: order.buyerId,
        amount: order.amount,
        platformFee: order.platformFee
      });

      await this.notificationsService.createMany([
        {
          userId: buyer.id,
          orderId: order.id,
          listingId: listing.id,
          channel: NotificationChannel.IN_APP,
          eventType: 'order.created',
          title: 'Complete payment',
          message: `Escrow checkout is ready for ${listing.brand.name}.`,
          metadata: {
            checkoutPaymentLinkId: checkout.paymentLinkId
          }
        },
        {
          userId: listing.seller.id,
          orderId: order.id,
          listingId: listing.id,
          channel: NotificationChannel.PUSH,
          eventType: 'listing.reserved',
          title: 'Listing reserved',
          message: `${buyer.name} started checkout for your ${listing.brand.name} voucher.`,
          metadata: {
            buyerId: buyer.id
          }
        }
      ]);

      return {
        order,
        checkout: { provider: 'RAZORPAY' as const, ...checkout }
      };
    } catch (error) {
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.CANCELLED
          }
        });

        await tx.voucherListing.update({
          where: { id: listing.id },
          data: {
            status: ListingStatus.ACTIVE,
            buyerId: null
          }
        });
      });

      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new ServiceUnavailableException('Checkout preparation failed.');
    }
  }

  async prepareCheckout(id: string, buyerUserId: string) {
    const order = await this.requireOrder(id);

    if (order.buyerId !== buyerUserId) {
      throw new BadRequestException('Only the buyer can initiate checkout.');
    }

    if (order.status !== OrderStatus.PAYMENT_PENDING) {
      throw new BadRequestException('Checkout can only be prepared for pending orders.');
    }

    const checkout = await this.paymentsService.prepareCheckout({
      id: order.id,
      listingId: order.listingId,
      buyerId: order.buyerId,
      amount: order.amount,
      platformFee: order.platformFee
    });

    return {
      order,
      checkout: { provider: 'RAZORPAY' as const, ...checkout }
    };
  }

  async verifyPayment(id: string, buyerUserId: string, dto: VerifyPaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { payment: true }
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} was not found.`);
    }

    if (order.buyerId !== buyerUserId) {
      throw new BadRequestException('Only the buyer can verify payment.');
    }

    if (order.status !== OrderStatus.PAYMENT_PENDING) {
      throw new BadRequestException('Payment can only be captured for pending orders.');
    }

    if (!order.payment?.razorpayOrderId) {
      throw new BadRequestException(
        'Prepare Razorpay checkout before verifying payment.'
      );
    }

    if (
      !dto.razorpayOrderId ||
      !dto.razorpayPaymentId ||
      !dto.razorpaySignature
    ) {
      throw new BadRequestException(
        'Razorpay payment verification requires order, payment, and signature IDs.'
      );
    }

    if (order.payment.razorpayOrderId !== dto.razorpayOrderId) {
      throw new BadRequestException('Razorpay order ID does not match the prepared checkout.');
    }

    const isValidSignature = this.paymentsService.verifySignature({
      orderId: dto.razorpayOrderId,
      paymentId: dto.razorpayPaymentId,
      signature: dto.razorpaySignature
    });

    if (!isValidSignature) {
      throw new BadRequestException('Razorpay payment signature is invalid.');
    }

    return this.activateEscrow(id, {
      method: dto.method,
      ...(dto.razorpayOrderId ? { razorpayOrderId: dto.razorpayOrderId } : {}),
      ...(dto.razorpayPaymentId ? { razorpayPaymentId: dto.razorpayPaymentId } : {}),
      ...(dto.razorpaySignature ? { razorpaySignature: dto.razorpaySignature } : {})
    });
  }

  /**
   * Called by the mobile app after the buyer returns from the Razorpay payment page.
   * Proactively fetches the payment link status from Razorpay and activates escrow if paid,
   * without waiting for Razorpay's webhook (which can lag 30s–2min).
   */
  async syncPaymentStatus(orderId: string, buyerUserId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true }
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} was not found.`);
    }

    if (order.buyerId !== buyerUserId) {
      throw new BadRequestException('Only the buyer can sync payment status.');
    }

    // If already past PAYMENT_PENDING, nothing to do — return current state.
    if (order.status !== OrderStatus.PAYMENT_PENDING) {
      return { synced: false, status: order.status };
    }

    const linkId = order.payment?.razorpayPaymentLinkId;
    if (!linkId) {
      return { synced: false, status: order.status };
    }

    const { paid, razorpayPaymentId } = await this.paymentsService.checkPaymentLinkStatus(linkId);

    if (!paid) {
      return { synced: false, status: order.status };
    }

    this.logger.log(`syncPaymentStatus: payment confirmed via pull for order=${orderId}, activating escrow.`);
    await this.activateEscrowForPaymentLink(linkId, razorpayPaymentId);

    // Reload and return the updated status.
    const updated = await this.prisma.order.findUnique({ where: { id: orderId } });
    return { synced: true, status: updated?.status ?? order.status };
  }

  async activateEscrowForPaymentLink(paymentLinkId: string, razorpayPaymentId?: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { razorpayPaymentLinkId: paymentLinkId }
    });

    if (!payment) {
      this.logger.warn(`activateEscrowForPaymentLink: no payment found for linkId=${paymentLinkId}`);
      return;
    }

    const order = await this.prisma.order.findUnique({ where: { id: payment.orderId } });

    if (!order || order.status !== OrderStatus.PAYMENT_PENDING) {
      return;
    }

    await this.activateEscrow(payment.orderId, {
      method: 'razorpay',
      ...(razorpayPaymentId ? { razorpayPaymentId } : {})
    });
  }

  async revealCode(id: string, viewerUserId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        listing: {
          include: {
            brand: true,
            codeVault: true
          }
        },
        buyer: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        seller: {
          select: {
            id: true,
            name: true
          }
        },
        payment: true
      }
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} was not found.`);
    }

    if (order.buyerId !== viewerUserId) {
      throw new BadRequestException('Only the buyer can reveal the voucher code.');
    }

    if (order.status !== OrderStatus.ESCROW_ACTIVE && order.status !== OrderStatus.CODE_REVEALED) {
      throw new BadRequestException('Voucher code can only be revealed after escrow activation.');
    }

    if (!order.listing.codeVault) {
      throw new NotFoundException('Encrypted voucher code is missing for this listing.');
    }

    const codeVault = order.listing.codeVault;
    const now = new Date();
    const verificationWindowHours =
      order.listing.faceValue > highValueThresholdInr
        ? Math.max(order.listing.brand.verificationWindowHours, highValueWindowHours)
        : order.listing.brand.verificationWindowHours;
    const verificationDeadline =
      order.verificationDeadline ??
      new Date(now.getTime() + verificationWindowHours * 60 * 60 * 1000);

    const code = this.codeVaultService.decrypt(codeVault);
    const watermarkedCodeImageUrl = this.codeVaultService.renderWatermarkedCodeCard({
      code,
      brandName: order.listing.brand.name,
      buyerName: order.buyer.name,
      buyerPhone: order.buyer.phone,
      orderId: order.id,
      verificationDeadline
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.CODE_REVEALED,
          codeRevealedAt: order.codeRevealedAt ?? now,
          verificationDeadline
        }
      });

      await tx.codeVault.update({
        where: { listingId: order.listingId },
        data: {
          viewCount: { increment: 1 },
          firstViewedAt: codeVault.firstViewedAt ?? now,
          lastViewedAt: now
        }
      });

      await tx.auditLog.create({
        data: {
          entityType: 'order',
          entityId: id,
          action: 'code.revealed',
          actorId: viewerUserId,
          metadata: {
            verificationDeadline: verificationDeadline.toISOString()
          }
        }
      });
    });

    await this.notificationsService.createMany([
      {
        userId: order.buyer.id,
        orderId: order.id,
        listingId: order.listingId,
        channel: NotificationChannel.PUSH,
        eventType: 'code.revealed',
        title: 'Voucher revealed',
        message: `Verification window is live for ${order.listing.brand.name}.`,
        metadata: {
          verificationDeadline: verificationDeadline.toISOString()
        }
      },
      {
        userId: order.seller.id,
        orderId: order.id,
        listingId: order.listingId,
        channel: NotificationChannel.IN_APP,
        eventType: 'buyer.revealed',
        title: 'Buyer opened the voucher',
        message: `The buyer has opened the ${order.listing.brand.name} code and the timer has started.`,
        metadata: {
          verificationDeadline: verificationDeadline.toISOString()
        }
      }
    ]);

    this.eventEmitter.emit('order.updated', {
      orderId: order.id,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      status: OrderStatus.CODE_REVEALED
    });

    return {
      watermarkedCodeImageUrl,
      voucherCode: code,
      verificationDeadline,
      revealCount: codeVault.viewCount + 1,
      verificationWindowHours
    };
  }

  async confirm(id: string, buyerUserId: string) {
    const order = await this.requireOrder(id);

    if (order.buyerId !== buyerUserId) {
      throw new BadRequestException('Only the buyer can confirm an order.');
    }

    if (order.status !== OrderStatus.CODE_REVEALED && order.status !== OrderStatus.DISPUTED) {
      throw new BadRequestException('Only revealed or disputed orders can be confirmed.');
    }

    return this.finalizeRelease(id, OrderStatus.CONFIRMED, new Date(), buyerUserId);
  }

  async createDispute(id: string, dto: CreateDisputeDto, raisedByUserId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        listing: {
          include: {
            brand: true
          }
        },
        seller: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} was not found.`);
    }

    if (order.status !== OrderStatus.CODE_REVEALED) {
      throw new BadRequestException('Disputes can only be raised after code reveal.');
    }

    if (raisedByUserId !== order.buyerId) {
      throw new BadRequestException('Only the buyer can raise the Phase 1 dispute.');
    }

    const dispute = await this.prisma.$transaction(async (tx) => {
      const createdDispute = await tx.dispute.create({
        data: {
          orderId: id,
          raisedById: raisedByUserId,
          reason: dto.reason,
          description: dto.description,
          evidenceUrls: dto.evidenceUrls ?? [],
          status: DisputeStatus.OPEN
        }
      });

      await tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.DISPUTED
        }
      });

      await tx.voucherListing.update({
        where: { id: order.listingId },
        data: {
          status: ListingStatus.DISPUTED
        }
      });

      await tx.auditLog.create({
        data: {
          entityType: 'dispute',
          entityId: createdDispute.id,
          action: 'dispute.created',
          actorId: raisedByUserId,
          metadata: {
            orderId: id,
            reason: dto.reason
          }
        }
      });

      return createdDispute;
    });

    await this.notificationsService.createMany([
      {
        userId: order.buyerId,
        orderId: order.id,
        listingId: order.listingId,
        channel: NotificationChannel.IN_APP,
        eventType: 'dispute.created',
        title: 'Dispute raised',
        message: 'Your issue has been recorded and escrow remains locked.',
        metadata: {
          disputeId: dispute.id
        }
      },
      {
        userId: order.seller.id,
        orderId: order.id,
        listingId: order.listingId,
        channel: NotificationChannel.PUSH,
        eventType: 'dispute.created',
        title: 'Buyer reported an issue',
        message: `A dispute was raised for your ${order.listing.brand.name} voucher.`,
        metadata: {
          disputeId: dispute.id
        }
      }
    ]);

    this.eventEmitter.emit('order.updated', {
      orderId: order.id,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      status: OrderStatus.DISPUTED
    });

    // Update seller dispute stats — may auto-suspend if dispute rate exceeds threshold
    await this.updateSellerDisputeStats(order.sellerId);

    return dispute;
  }

  async resolveDispute(id: string, resolution: DisputeResolution) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            payment: true,
            listing: {
              include: {
                brand: true
              }
            },
            buyer: {
              select: {
                id: true,
                name: true
              }
            },
            seller: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute ${id} was not found.`);
    }

    if (dispute.status === DisputeStatus.RESOLVED) {
      throw new BadRequestException('Dispute is already resolved.');
    }

    if (resolution === DisputeResolution.RELEASE_TO_SELLER) {
      await this.finalizeRelease(dispute.orderId, OrderStatus.CONFIRMED, new Date(), null);
    } else {
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: dispute.orderId },
          data: {
            status: OrderStatus.CANCELLED,
            confirmedAt: new Date()
          }
        });

        await tx.voucherListing.update({
          where: { id: dispute.order.listingId },
          data: {
            status: ListingStatus.REFUNDED,
            buyerId: null
          }
        });

        if (dispute.order.payment) {
          await tx.payment.update({
            where: { orderId: dispute.orderId },
            data: {
              status: PaymentStatus.REFUNDED,
              escrowStatus: EscrowStatus.REFUNDED,
              refundCompletedAt: new Date()
            }
          });
        }

        await tx.auditLog.create({
          data: {
            entityType: 'dispute',
            entityId: dispute.id,
            action: 'dispute.refund_initiated',
            actorId: null,
            metadata: { orderId: dispute.orderId }
          }
        });
      });

      // Execute the actual refund via Razorpay (no-op for MOCK provider)
      if (dispute.order.payment?.razorpayPaymentId) {
        try {
          await this.paymentsService.executeRefund(
            dispute.order.payment.razorpayPaymentId,
            dispute.order.payment.amount
          );
        } catch (error) {
          this.logger.error(
            `Razorpay refund failed for dispute ${dispute.id}: ${error instanceof Error ? error.message : String(error)}. Manual refund required.`
          );
          // Don't rethrow — DB already updated, ops team must handle manually
        }
      }
    }

    const resolvedDispute = await this.prisma.dispute.update({
      where: { id },
      data: {
        status: DisputeStatus.RESOLVED,
        resolution,
        resolvedAt: new Date()
      }
    });

    await this.notificationsService.createMany([
      {
        userId: dispute.order.buyer.id,
        orderId: dispute.order.id,
        listingId: dispute.order.listingId,
        channel: NotificationChannel.PUSH,
        eventType: 'dispute.resolved',
        title:
          resolution === DisputeResolution.REFUND_BUYER
            ? 'Refund approved'
            : 'Dispute closed',
        message:
          resolution === DisputeResolution.REFUND_BUYER
            ? `Refund approved for ${dispute.order.listing.brand.name}.`
            : `Escrow was released to the seller for ${dispute.order.listing.brand.name}.`,
        metadata: {
          resolution
        }
      },
      {
        userId: dispute.order.seller.id,
        orderId: dispute.order.id,
        listingId: dispute.order.listingId,
        channel: NotificationChannel.PUSH,
        eventType: 'dispute.resolved',
        title:
          resolution === DisputeResolution.RELEASE_TO_SELLER
            ? 'Escrow released'
            : 'Dispute refunded',
        message:
          resolution === DisputeResolution.RELEASE_TO_SELLER
            ? `Payout released for ${dispute.order.listing.brand.name}.`
            : `Buyer refund approved for ${dispute.order.listing.brand.name}.`,
        metadata: {
          resolution
        }
      }
    ]);

    return resolvedDispute;
  }

  /**
   * Seller submits their response/evidence to an open dispute.
   * Moves dispute to UNDER_REVIEW so admin can review both sides.
   */
  async submitSellerDisputeResponse(
    disputeId: string,
    sellerId: string,
    response: string
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        order: {
          include: {
            buyer: { select: { id: true } }
          }
        }
      }
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute ${disputeId} was not found.`);
    }

    if (dispute.order.sellerId !== sellerId) {
      throw new BadRequestException('Only the seller can respond to this dispute.');
    }

    if (dispute.status === DisputeStatus.RESOLVED) {
      throw new BadRequestException('Cannot respond to a resolved dispute.');
    }

    if (dispute.sellerResponse) {
      throw new BadRequestException('Seller response has already been submitted.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const d = await tx.dispute.update({
        where: { id: disputeId },
        data: {
          sellerResponse: response,
          status: DisputeStatus.UNDER_REVIEW
        }
      });

      await tx.auditLog.create({
        data: {
          entityType: 'dispute',
          entityId: disputeId,
          action: 'dispute.seller_responded',
          actorId: sellerId,
          metadata: {}
        }
      });

      return d;
    });

    await this.notificationsService.createNotification({
      userId: dispute.order.buyer.id,
      orderId: dispute.order.id,
      channel: NotificationChannel.IN_APP,
      eventType: 'dispute.seller_responded',
      title: 'Seller responded to your dispute',
      message: 'The seller has submitted a response. An admin will review both sides shortly.',
      metadata: { disputeId }
    });

    return updated;
  }

  /**
   * Send verification deadline reminders at 60min, 30min, 5min marks.
   * Uses existing notifications as sent-markers to avoid duplicates.
   */
  async sendVerificationReminders(): Promise<number> {
    const now = new Date();
    const reminderWindows = [
      { minutesBefore: 60, eventType: 'code.reveal_reminder_60min', label: '1 hour' },
      { minutesBefore: 30, eventType: 'code.reveal_reminder_30min', label: '30 minutes' },
      { minutesBefore: 5, eventType: 'code.reveal_reminder_5min', label: '5 minutes' }
    ] as const;

    let sent = 0;

    for (const window of reminderWindows) {
      // Find orders whose deadline falls within a 5-minute window around this reminder point
      const deadlineFrom = new Date(now.getTime() + (window.minutesBefore - 3) * 60 * 1000);
      const deadlineTo = new Date(now.getTime() + (window.minutesBefore + 3) * 60 * 1000);

      const orders = await this.prisma.order.findMany({
        where: {
          status: OrderStatus.CODE_REVEALED,
          verificationDeadline: { gte: deadlineFrom, lte: deadlineTo }
        },
        include: {
          listing: { include: { brand: true } }
        }
      });

      for (const order of orders) {
        // Check if this reminder was already sent (use notification as idempotency key)
        const alreadySent = await this.prisma.notification.findFirst({
          where: { orderId: order.id, eventType: window.eventType }
        });
        if (alreadySent) continue;

        await this.notificationsService.createNotification({
          userId: order.buyerId,
          orderId: order.id,
          listingId: order.listingId,
          channel: NotificationChannel.PUSH,
          eventType: window.eventType,
          title: `${window.label} left to verify`,
          message: `Verify your ${order.listing.brand.name} voucher now or it will be auto-confirmed. ${window.label} remaining.`,
          metadata: { verificationDeadline: order.verificationDeadline?.toISOString() }
        });
        sent++;
      }
    }

    return sent;
  }

  /**
   * Recovery for HLD Scenario 2: orders stuck in CODE_REVEALED with no deadline set
   * (server crash between reveal and deadline write). Sets a fresh deadline.
   */
  async recoverMissingDeadlines(): Promise<number> {
    const stuck = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.CODE_REVEALED,
        verificationDeadline: null
      },
      include: {
        listing: { include: { brand: true } }
      }
    });

    for (const order of stuck) {
      const windowHours = order.listing.brand.verificationWindowHours;
      // Use a conservative recovery: deadline starts from now (not from when reveal happened)
      const deadline = new Date(Date.now() + windowHours * 60 * 60 * 1000);
      await this.prisma.order.update({
        where: { id: order.id },
        data: { verificationDeadline: deadline }
      });
      this.logger.warn(
        `Recovered NULL verificationDeadline for order ${order.id}. New deadline: ${deadline.toISOString()}`
      );
    }

    return stuck.length;
  }

  async autoConfirmExpiredOrders() {
    const staleOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.CODE_REVEALED,
        verificationDeadline: { lte: new Date() }
      }
    });

    for (const order of staleOrders) {
      await this.finalizeRelease(order.id, OrderStatus.AUTO_CONFIRMED, new Date(), null);
    }

    return staleOrders.length;
  }

  /**
   * Cancel orders that have been PAYMENT_PENDING beyond the payment window.
   * Releases the listing back to ACTIVE so other buyers can purchase it.
   * Uses conditional updateMany to safely handle races with the reconciliation job.
   */
  async cancelStalePaymentPendingOrders(timeoutMinutes: number): Promise<number> {
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    const staleOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PAYMENT_PENDING,
        createdAt: { lte: cutoff }
      },
      include: {
        listing: { include: { brand: true } },
        buyer: { select: { id: true, name: true } },
        payment: true
      }
    });

    let cancelled = 0;

    for (const order of staleOrders) {
      const updated = await this.prisma.$transaction(async (tx) => {
        // Conditional update: only proceed if still PAYMENT_PENDING.
        // If reconciliation activated escrow between our read and this write, count = 0.
        const result = await tx.order.updateMany({
          where: { id: order.id, status: OrderStatus.PAYMENT_PENDING },
          data: { status: OrderStatus.CANCELLED }
        });

        if (result.count === 0) return false;

        await tx.voucherListing.updateMany({
          where: { id: order.listingId, status: ListingStatus.RESERVED },
          data: { status: ListingStatus.ACTIVE, buyerId: null }
        });

        if (order.payment) {
          await tx.payment.update({
            where: { orderId: order.id },
            data: { status: PaymentStatus.FAILED }
          });
        }

        await tx.auditLog.create({
          data: {
            entityType: 'order',
            entityId: order.id,
            action: 'order.payment_timeout',
            actorId: null,
            metadata: { timeoutMinutes }
          }
        });

        return true;
      });

      if (updated) {
        cancelled++;
        await this.notificationsService.createMany([
          {
            userId: order.buyerId,
            orderId: order.id,
            listingId: order.listingId,
            channel: NotificationChannel.IN_APP,
            eventType: 'order.payment_timeout',
            title: 'Payment window expired',
            message: `Your ${order.listing.brand.name} reservation was released. The listing is available again.`,
            metadata: { timeoutMinutes }
          }
        ]);
      }
    }

    return cancelled;
  }

  /**
   * Called by the webhook handler when RazorpayX fires payout.processed,
   * payout.failed, or payout.reversed.
   */
  async handlePayoutWebhook(
    razorpayPayoutId: string,
    event: 'payout.processed' | 'payout.failed' | 'payout.reversed'
  ): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { razorpayPayoutId }
    });

    if (!payment) {
      this.logger.warn(`handlePayoutWebhook: no payment found for razorpayPayoutId=${razorpayPayoutId}`);
      return;
    }

    if (event === 'payout.processed') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { payoutStatus: PayoutStatus.COMPLETED, payoutCompletedAt: new Date() }
      });
      this.logger.log(`Payout completed: ${razorpayPayoutId} orderId=${payment.orderId}`);
    } else {
      const reason = event === 'payout.reversed' ? 'reversed by bank' : 'payout failed';
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { payoutStatus: PayoutStatus.FAILED, payoutFailureReason: reason }
      });
      await this.prisma.auditLog.create({
        data: {
          entityType: 'payment',
          entityId: payment.id,
          action: 'payment.payout_failed',
          actorId: null,
          metadata: { orderId: payment.orderId, razorpayPayoutId, event, reason }
        }
      });
      this.logger.error(`Payout ${event}: ${razorpayPayoutId} orderId=${payment.orderId}`);
    }
  }

  /**
   * HLD Scenario 4 — voucher expiry during escrow.
   * Finds ESCROW_ACTIVE / CODE_REVEALED orders where the underlying voucher
   * has expired. Cancels the order and marks payment as REFUNDED (pending
   * manual payout via admin). No seller strike — not their fault.
   */
  async cancelExpiredEscrowOrders(): Promise<number> {
    const expiredEscrows = await this.prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.ESCROW_ACTIVE, OrderStatus.CODE_REVEALED] },
        listing: { expiryDate: { lte: new Date() } }
      },
      include: {
        listing: { include: { brand: true } },
        buyer: { select: { id: true, name: true } },
        seller: { select: { id: true, name: true } },
        payment: true
      }
    });

    for (const order of expiredEscrows) {
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.CANCELLED, confirmedAt: new Date() }
        });

        await tx.voucherListing.update({
          where: { id: order.listingId },
          data: { status: ListingStatus.REFUNDED, buyerId: null }
        });

        if (order.payment) {
          await tx.payment.update({
            where: { orderId: order.id },
            data: {
              status: PaymentStatus.REFUNDED,
              escrowStatus: EscrowStatus.REFUNDED,
              refundCompletedAt: new Date()
            }
          });
        }

        await tx.auditLog.create({
          data: {
            entityType: 'order',
            entityId: order.id,
            action: 'order.voucher_expired_in_escrow',
            actorId: null,
            metadata: { listingId: order.listingId }
          }
        });
      });

      await this.notificationsService.createMany([
        {
          userId: order.buyerId,
          orderId: order.id,
          listingId: order.listingId,
          channel: NotificationChannel.PUSH,
          eventType: 'order.voucher_expired',
          title: 'Voucher expired — refund pending',
          message: `The ${order.listing.brand.name} voucher expired during escrow. A refund will be processed shortly.`,
          metadata: {}
        },
        {
          userId: order.sellerId,
          orderId: order.id,
          listingId: order.listingId,
          channel: NotificationChannel.IN_APP,
          eventType: 'order.voucher_expired',
          title: 'Order cancelled — voucher expired',
          message: `The ${order.listing.brand.name} voucher expired while escrow was active. No seller strike applied.`,
          metadata: {}
        }
      ]);
    }

    return expiredEscrows.length;
  }

  private async activateEscrow(
    orderId: string,
    paymentDetails: {
      readonly method: string;
      readonly razorpayPaymentId?: string;
      readonly razorpayOrderId?: string;
      readonly razorpaySignature?: string;
    }
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { id: true, name: true, phone: true } },
        seller: { select: { id: true, name: true, phone: true } },
        payment: true,
        listing: { include: { brand: true } }
      }
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} was not found.`);
    }

    const provider = order.payment?.provider ?? PaymentProvider.RAZORPAY;

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const paymentData = {
        amount: order.amount + order.platformFee,
        method: paymentDetails.method,
        status: PaymentStatus.CAPTURED,
        escrowStatus: EscrowStatus.ACTIVE,
        provider,
        currency: order.payment?.currency ?? 'INR',
        capturedAt: new Date(),
        ...(paymentDetails.razorpayOrderId ? { razorpayOrderId: paymentDetails.razorpayOrderId } : {}),
        ...(paymentDetails.razorpayPaymentId ? { razorpayPaymentId: paymentDetails.razorpayPaymentId } : {}),
        ...(paymentDetails.razorpaySignature ? { razorpaySignature: paymentDetails.razorpaySignature } : {})
      };

      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.ESCROW_ACTIVE }
      });

      if (order.payment) {
        await tx.payment.update({ where: { orderId }, data: paymentData });
      } else {
        await tx.payment.create({ data: { orderId, ...paymentData } });
      }

      await tx.auditLog.create({
        data: {
          entityType: 'order',
          entityId: orderId,
          action: 'payment.captured',
          actorId: order.buyerId,
          metadata: { method: paymentDetails.method, provider }
        }
      });

      return tx.order.findUnique({
        where: { id: orderId },
        include: { payment: true, listing: { include: { brand: true } } }
      });
    });

    await this.notificationsService.createMany([
      {
        userId: order.buyer.id,
        orderId: order.id,
        listingId: order.listingId,
        channel: NotificationChannel.PUSH,
        eventType: 'payment.captured',
        title: 'Escrow funded',
        message: `Payment received. You can now reveal the ${order.listing.brand.name} voucher.`,
        metadata: { method: paymentDetails.method }
      },
      {
        userId: order.seller.id,
        orderId: order.id,
        listingId: order.listingId,
        channel: NotificationChannel.PUSH,
        eventType: 'payment.captured',
        title: 'Buyer funded escrow',
        message: `Escrow is active for your ${order.listing.brand.name} voucher.`,
        metadata: { orderId: order.id }
      }
    ]);

    this.eventEmitter.emit('order.updated', {
      orderId: order.id,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      status: OrderStatus.ESCROW_ACTIVE
    });

    return updatedOrder;
  }

  private async finalizeRelease(
    id: string,
    status: OrderStatus,
    confirmedAt: Date,
    actorId: string | null
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        payment: true,
        listing: {
          include: {
            brand: true
          }
        },
        buyer: {
          select: {
            id: true,
            name: true
          }
        },
        seller: {
          select: {
            id: true,
            name: true,
            payoutAccount: true
          }
        }
      }
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} was not found.`);
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          status,
          confirmedAt
        }
      });

      await tx.voucherListing.update({
        where: { id: order.listingId },
        data: {
          status: ListingStatus.SOLD,
          soldAt: confirmedAt
        }
      });

      if (order.payment) {
        await tx.payment.update({
          where: { orderId: id },
          data: {
            escrowStatus: EscrowStatus.RELEASED,
            payoutStatus: PayoutStatus.PENDING
          }
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: 'order',
          entityId: id,
          action:
            status === OrderStatus.AUTO_CONFIRMED
              ? 'order.auto_confirmed'
              : 'order.confirmed',
          actorId
        }
      });

      return tx.order.findUnique({
        where: { id },
        include: {
          listing: true,
          payment: true
        }
      });
    });

    // Increment seller totalSales counter
    await this.prisma.user.update({
      where: { id: order.sellerId },
      data: { totalSales: { increment: 1 } }
    });

    // Attempt automatic payout via Razorpay after the transaction commits
    const payoutAccount = order.seller.payoutAccount;
    const fundAccountId = payoutAccount?.razorpayFundAccountId;
    const kycVerified = payoutAccount?.kycStatus === 'VERIFIED';
    if (order.payment && payoutAccount && fundAccountId && kycVerified) {
      try {
        const razorpayPayoutId = await this.paymentsService.executePayout(
          fundAccountId,
          order.sellerPayout,
          id,
          payoutAccount.type
        );
        await this.prisma.payment.update({
          where: { orderId: id },
          data: {
            payoutStatus: PayoutStatus.PROCESSING,
            razorpayPayoutId,
            payoutInitiatedAt: new Date()
          }
        });
      } catch (err) {
        this.logger.error(`Auto-payout failed for order ${id}: ${String(err)}`);
        await this.prisma.payment.update({
          where: { orderId: id },
          data: {
            payoutStatus: PayoutStatus.FAILED,
            payoutFailureReason: String(err)
          }
        });
        await this.prisma.auditLog.create({
          data: {
            entityType: 'payment',
            entityId: order.payment.id,
            action: 'payment.payout_failed',
            actorId: null,
            metadata: { orderId: id, sellerPayoutInr: order.sellerPayout, error: String(err) }
          }
        });
      }
    }

    let sellerPayoutMsg: string;
    if (!payoutAccount) {
      sellerPayoutMsg = `₹${String(order.sellerPayout)} will be settled once you add a payout account`;
    } else if (!kycVerified) {
      sellerPayoutMsg = `₹${String(order.sellerPayout)} is held pending KYC verification. Complete KYC in Settings to receive your payout.`;
    } else {
      sellerPayoutMsg = payoutAccount.upiId
        ? `₹${String(order.sellerPayout)} is being transferred to ${payoutAccount.upiId}`
        : `₹${String(order.sellerPayout)} will be settled to your bank account`;
    }

    await this.notificationsService.createMany([
      {
        userId: order.buyer.id,
        orderId: order.id,
        listingId: order.listingId,
        channel: NotificationChannel.PUSH,
        eventType:
          status === OrderStatus.AUTO_CONFIRMED ? 'order.auto_confirmed' : 'order.confirmed',
        title: status === OrderStatus.AUTO_CONFIRMED ? 'Order auto-confirmed' : 'Order confirmed',
        message: `Payment released for ${order.listing.brand.name}.`,
        metadata: {
          confirmedAt: confirmedAt.toISOString()
        }
      },
      {
        userId: order.seller.id,
        orderId: order.id,
        listingId: order.listingId,
        channel: NotificationChannel.PUSH,
        eventType:
          status === OrderStatus.AUTO_CONFIRMED ? 'order.auto_confirmed' : 'order.confirmed',
        title: 'Payout initiated',
        message: sellerPayoutMsg,
        metadata: {
          confirmedAt: confirmedAt.toISOString(),
          sellerPayoutInr: order.sellerPayout
        }
      }
    ]);

    this.eventEmitter.emit('order.updated', {
      orderId: order.id,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      status
    });

    return updatedOrder;
  }

  private async requireOrder(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { payment: true }
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} was not found.`);
    }

    return order;
  }

  private async updateSellerDisputeStats(sellerId: string) {
    const disputeRateThreshold = Number(process.env.SELLER_DISPUTE_RATE_THRESHOLD ?? 0.3);
    const minSalesForCheck = Number(process.env.SELLER_MIN_SALES_FOR_RATE_CHECK ?? 3);

    const seller = await this.prisma.user.update({
      where: { id: sellerId },
      data: { disputeCount: { increment: 1 } },
      select: { id: true, disputeCount: true, totalSales: true, status: true }
    });

    if (
      seller.status === UserStatus.ACTIVE &&
      seller.totalSales >= minSalesForCheck &&
      seller.disputeCount / seller.totalSales > disputeRateThreshold
    ) {
      await this.prisma.user.update({
        where: { id: sellerId },
        data: { status: UserStatus.SUSPENDED }
      });
      await this.prisma.auditLog.create({
        data: {
          entityType: 'user',
          entityId: sellerId,
          action: 'user.auto_suspended',
          actorId: null,
          metadata: {
            reason: 'dispute_rate_exceeded',
            disputeCount: seller.disputeCount,
            totalSales: seller.totalSales,
            rate: seller.disputeCount / seller.totalSales
          }
        }
      });
      this.logger.warn(
        `Seller ${sellerId} auto-suspended: ${String(seller.disputeCount)}/${String(seller.totalSales)} dispute rate`
      );
    }
  }
}
