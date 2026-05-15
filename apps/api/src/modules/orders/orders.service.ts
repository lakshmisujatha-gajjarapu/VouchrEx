import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
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
  RefundStatus,
  Prisma
} from '@prisma/client';

import { ONE_HOUR_MS, ONE_MINUTE_MS } from '../../common/time.constants';
import { AppConfigService } from '../app-config/app-config.service';
import { StorageService } from '../storage/storage.service';
import { CodeVaultService } from '../listings/services/code-vault.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { USER_TIERS } from '../users/users.constants';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  BUYER_MAX_ORDERS_PER_HOUR_DEFAULT,
  DEFAULT_CURRENCY,
  VERIFICATION_REMINDER_MATCH_WINDOW_MINUTES,
  VERIFICATION_REMINDER_WINDOWS,
  highValueThresholdInr,
  highValueWindowHours
} from './orders.constants';
import { DisputeStrikesService } from './dispute-strikes.service';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private static readonly EVIDENCE_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  private static readonly EVIDENCE_MAX_SIZE_BYTES = 5 * 1024 * 1024;

  constructor(
    private readonly prisma: PrismaService,
    private readonly codeVaultService: CodeVaultService,
    private readonly notificationsService: NotificationsService,
    private readonly paymentsService: PaymentsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly disputeStrikes: DisputeStrikesService,
    private readonly appConfigService: AppConfigService,
    private readonly storageService: StorageService
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
            phone: true,
            trustScore: true
          }
        }
      }
    });

    if (!listing) {
      throw new NotFoundException(`Listing ${createOrderDto.listingId} was not found.`);
    }

    // Block purchases from BLOCKED-tier sellers (trustScore < 30) per HLD/07.
    if (listing.seller.trustScore < 30) {
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
    const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS);
    const recentBuyerOrders = await this.prisma.order.count({
      where: {
        buyerId: buyer.id,
        createdAt: { gte: oneHourAgo },
        status: { not: OrderStatus.CANCELLED }
      }
    });
    const buyerMaxOrdersPerHour = Number(process.env.BUYER_MAX_ORDERS_PER_HOUR ?? BUYER_MAX_ORDERS_PER_HOUR_DEFAULT);
    if (recentBuyerOrders >= buyerMaxOrdersPerHour) {
      throw new BadRequestException('Too many purchases in a short period. Please try again later.');
    }

    // Bronze users cannot purchase high-value vouchers (HLD fraud rule B5 / trust tier gating)
    if (buyer.tier === USER_TIERS.BRONZE && listing.sellingPrice > highValueThresholdInr) {
      throw new BadRequestException(
        'New accounts cannot purchase high-value vouchers. Complete more transactions to raise your trust tier.'
      );
    }

    const buyerFeeRate = await this.appConfigService.getNumber('buyer_fee_rate', 0.10);
    const sellerCommissionRate = await this.appConfigService.getNumber('seller_commission_rate', 0.10);
    const platformFee = Math.round(listing.sellingPrice * buyerFeeRate);
    const commission = Math.round(listing.sellingPrice * sellerCommissionRate);
    const sellerPayout = listing.sellingPrice - commission;

    let order;
    try {
      order = await this.prisma.$transaction(async (tx) => {
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

        // Conditional reservation: only succeeds if listing is still ACTIVE.
        // If a concurrent buyer already reserved it, count === 0 and we throw here,
        // rolling back the order.create and auditLog writes above.
        const reservation = await tx.voucherListing.updateMany({
          where: { id: listing.id, status: ListingStatus.ACTIVE },
          data: {
            status: ListingStatus.RESERVED,
            buyerId: buyer.id
          }
        });
        if (reservation.count === 0) {
          throw new BadRequestException('Listing is no longer available.');
        }

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
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('Listing is no longer available.');
      }
      throw e;
    }

    this.eventEmitter.emit('listing.updated', {
      listingId: listing.id,
      status: ListingStatus.RESERVED
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
            checkoutOrderId: checkout.razorpayOrderId
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

      this.eventEmitter.emit('listing.updated', {
        listingId: listing.id,
        status: ListingStatus.ACTIVE
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
   * Proactively fetches the Razorpay order payment status and activates escrow if captured,
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

    if (order.status !== OrderStatus.PAYMENT_PENDING) {
      return { synced: false, status: order.status };
    }

    const rzpOrderId = order.payment?.razorpayOrderId;
    if (!rzpOrderId) {
      return { synced: false, status: order.status };
    }

    const { captured, razorpayPaymentId } =
      await this.paymentsService.checkRazorpayOrderPaymentStatus(rzpOrderId);

    if (!captured) {
      return { synced: false, status: order.status };
    }

    this.logger.log(`syncPaymentStatus: payment captured for order=${orderId}, activating escrow.`);
    await this.activateEscrowForOrder(rzpOrderId, razorpayPaymentId);

    const updated = await this.prisma.order.findUnique({ where: { id: orderId } });
    return { synced: true, status: updated?.status ?? order.status };
  }

  async activateEscrowForOrder(razorpayOrderId: string, razorpayPaymentId?: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { razorpayOrderId }
    });

    if (!payment) {
      this.logger.warn(`activateEscrowForOrder: no payment found for razorpayOrderId=${razorpayOrderId}`);
      return;
    }

    const order = await this.prisma.order.findUnique({ where: { id: payment.orderId } });

    if (!order || order.status !== OrderStatus.PAYMENT_PENDING) {
      return;
    }

    await this.activateEscrow(payment.orderId, {
      method: 'razorpay',
      razorpayOrderId,
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

    if (order.payment?.status !== PaymentStatus.CAPTURED) {
      throw new BadRequestException('Payment has not been captured yet.');
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
      new Date(now.getTime() + verificationWindowHours * ONE_HOUR_MS);

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

    const pin =
      codeVault.encryptedPin && codeVault.encryptionPinIv && codeVault.encryptionPinTag
        ? this.codeVaultService.decrypt({
            encryptedCode: codeVault.encryptedPin,
            encryptionIv: codeVault.encryptionPinIv,
            encryptionTag: codeVault.encryptionPinTag
          })
        : null;

    return {
      watermarkedCodeImageUrl,
      voucherCode: code,
      verificationDeadline,
      revealCount: codeVault.viewCount + 1,
      verificationWindowHours,
      ...(pin ? { pin } : {})
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

    const result = await this.finalizeRelease(id, OrderStatus.CONFIRMED, new Date(), buyerUserId);
    if (result === null) {
      throw new BadRequestException('Order is not in a confirmable state.');
    }
    return result;
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
      throw new BadRequestException('Only the buyer can raise a dispute on this order.');
    }

    const { dispute, listingTransitioned } = await this.prisma.$transaction(async (tx) => {
      // Atomically claim the CODE_REVEALED → DISPUTED transition first.
      // If another concurrent request (e.g. confirm) already moved the order,
      // count = 0 and we throw here — rolling back everything in this tx.
      const orderUpdateResult = await tx.order.updateMany({
        where: { id, status: OrderStatus.CODE_REVEALED },
        data: {
          status: OrderStatus.DISPUTED
        }
      });
      if (orderUpdateResult.count === 0) {
        throw new BadRequestException('Order is not in a disputable state.');
      }

      const createdDispute = await tx.dispute.create({
        data: {
          orderId: id,
          raisedById: raisedByUserId,
          reason: dto.reason,
          description: dto.description,
          evidenceUrls: [],
          evidenceDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: DisputeStatus.OPEN
        }
      });

      // Conditional: only flip listing if it's still RESERVED. If a concurrent
      // transition (e.g. confirm) beat us to it, count = 0 and we skip the emit.
      const listingResult = await tx.voucherListing.updateMany({
        where: { id: order.listingId, status: ListingStatus.RESERVED },
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

      return { dispute: createdDispute, listingTransitioned: listingResult.count > 0 };
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
      },
      {
        userId: order.buyerId,
        orderId: order.id,
        listingId: order.listingId,
        channel: NotificationChannel.PUSH,
        eventType: 'dispute.evidence.reminder',
        title: 'Add evidence to your dispute',
        message: 'Attach screenshots to strengthen your case. You have 24 hours.',
        metadata: {
          disputeId: dispute.id,
          evidenceDeadlineAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      }
    ]);

    this.eventEmitter.emit('order.updated', {
      orderId: order.id,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      status: OrderStatus.DISPUTED
    });

    this.eventEmitter.emit('dispute.created', {
      orderId: order.id,
      listingId: order.listingId,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      raisedByUserId
    });

    if (listingTransitioned) {
      this.eventEmitter.emit('listing.updated', {
        listingId: order.listingId,
        status: ListingStatus.DISPUTED
      });
    }

    // Increment disputeCount as a fraud signal (raised against this seller, outcome-independent).
    // Strike application happens later at resolution time, not here.
    await this.prisma.user.update({
      where: { id: order.sellerId },
      data: { disputeCount: { increment: 1 } }
    });

    return dispute;
  }

  async addDisputeEvidence(orderId: string, buyerId: string, file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('No file attached.');
    }

    if (!OrdersService.EVIDENCE_ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, or WebP images are allowed.');
    }
    if (file.size > OrdersService.EVIDENCE_MAX_SIZE_BYTES) {
      throw new BadRequestException('File size must be 5MB or less.');
    }

    const dispute = await this.prisma.dispute.findUnique({
      where: { orderId },
      include: { order: { select: { buyerId: true } } }
    });

    if (!dispute) {
      throw new NotFoundException('No dispute found for this order.');
    }
    if (dispute.order.buyerId !== buyerId) {
      throw new ForbiddenException('Only the buyer can add evidence.');
    }
    if (!([DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW] as DisputeStatus[]).includes(dispute.status)) {
      throw new BadRequestException('Evidence can only be added to open disputes.');
    }
    if (!dispute.evidenceDeadline || new Date() > dispute.evidenceDeadline) {
      throw new BadRequestException('The evidence upload window has closed.');
    }
    if (dispute.evidenceUrls.length >= 3) {
      throw new BadRequestException('Maximum 3 evidence images allowed.');
    }

    const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const key = `dispute-evidence/${orderId}/${randomUUID()}.${ext}`;
    await this.storageService.uploadFile(key, file.buffer, file.mimetype);

    // Upload before DB write: if update fails, the object is orphaned in storage.
    // Accepted trade-off for Phase 1 — the alternative order (DB first) would store
    // a key that points to a non-existent object. Cleanup path is manual for now.
    const updated = await this.prisma.dispute.update({
      where: { id: dispute.id },
      data: { evidenceUrls: { push: key } },
      select: { evidenceUrls: true, evidenceDeadline: true }
    });

    return {
      key,
      totalCount: updated.evidenceUrls.length,
      deadlineAt: updated.evidenceDeadline?.toISOString() ?? null
    };
  }

  async resolveDispute(id: string, resolution: DisputeResolution, actorId: string | null) {
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

    // Atomic claim: only the first concurrent call wins; the loser sees count === 0.
    const claim = await this.prisma.dispute.updateMany({
      where: { id, status: { not: DisputeStatus.RESOLVED } },
      data: {
        status: DisputeStatus.RESOLVED,
        resolution,
        resolvedAt: new Date(),
        resolvedById: actorId
      }
    });
    if (claim.count === 0) {
      throw new BadRequestException('Dispute is already resolved.');
    }

    if (resolution === DisputeResolution.RELEASE_TO_SELLER) {
      await this.finalizeRelease(dispute.orderId, OrderStatus.CONFIRMED, new Date(), null);
    } else {
      await this.initiateDisputeRefund(dispute.id, dispute.orderId, actorId);
    }

    const resolvedDispute = await this.prisma.dispute.findUnique({ where: { id } });

    if (!resolvedDispute) {
      throw new NotFoundException(`Dispute ${id} disappeared during resolution.`);
    }

    const outcome = await this.disputeStrikes.applyDisputeStrike(id, resolution, actorId);
    const brandName = dispute.order.listing.brand.name;

    const buyerMessage =
      resolution === DisputeResolution.REFUND_BUYER
        ? `Refund approved for ${brandName}.`
        : outcome.role === 'buyer'
          ? `Your dispute was not upheld. Strike ${String(outcome.strikeNumber)}/3. Your account score is now ${String(outcome.newTrustScore)}.`
          : `Escrow was released to the seller for ${brandName}.`;

    const sellerMessage =
      resolution === DisputeResolution.RELEASE_TO_SELLER
        ? `Payout released for ${brandName}.`
        : outcome.role === 'seller'
          ? `Buyer refund approved for ${brandName}. Strike ${String(outcome.strikeNumber)}/3. Your seller score is now ${String(outcome.newTrustScore)}.`
          : `Buyer refund approved for ${brandName}.`;

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
        message: buyerMessage,
        metadata: { resolution }
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
        message: sellerMessage,
        metadata: { resolution }
      }
    ]);

    return resolvedDispute;
  }

  /**
   * Mark a dispute refund as in-flight in the DB, then call Razorpay.
   * On Razorpay success: payment.status -> REFUNDED, refundStatus -> COMPLETED.
   * On Razorpay failure: refundStatus -> FAILED with reason; payment.status stays CAPTURED
   * so admin can retry via /orders/:id/retry-refund. Order/listing state still flips to
   * CANCELLED/REFUNDED — the buyer's voucher is gone either way; only the money movement
   * is the open question.
   */
  private async initiateDisputeRefund(
    disputeId: string,
    orderId: string,
    actorId: string | null
  ): Promise<void> {
    const { order, listingTransitioned } = await this.prisma.$transaction(async (tx) => {
      const orderResult = await tx.order.updateMany({
        where: {
          id: orderId,
          status: { in: [OrderStatus.DISPUTED, OrderStatus.CODE_REVEALED, OrderStatus.ESCROW_ACTIVE] }
        },
        data: {
          status: OrderStatus.CANCELLED,
          confirmedAt: new Date()
        }
      });
      if (orderResult.count === 0) {
        throw new BadRequestException('Order is no longer eligible for refund.');
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const updatedOrder = (await tx.order.findUnique({
        where: { id: orderId },
        include: { payment: true }
      }))!;

      // Conditional: only flip listing if it's still DISPUTED. Skip the emit if
      // a concurrent transition already moved it.
      const listingResult = await tx.voucherListing.updateMany({
        where: { id: updatedOrder.listingId, status: ListingStatus.DISPUTED },
        data: {
          status: ListingStatus.REFUNDED,
          buyerId: null
        }
      });

      if (updatedOrder.payment) {
        await tx.payment.update({
          where: { orderId },
          data: {
            escrowStatus: EscrowStatus.REFUNDED,
            refundStatus: RefundStatus.PROCESSING,
            refundInitiatedAt: new Date(),
            refundFailureReason: null,
            refundAttempts: { increment: 1 }
          }
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: 'dispute',
          entityId: disputeId,
          action: 'dispute.refund_initiated',
          actorId,
          metadata: { orderId }
        }
      });

      return { order: updatedOrder, listingTransitioned: listingResult.count > 0 };
    });

    if (listingTransitioned) {
      this.eventEmitter.emit('listing.updated', {
        listingId: order.listingId,
        status: ListingStatus.REFUNDED
      });
    }

    if (order.payment?.razorpayPaymentId) {
      await this.executeAndRecordRefund(
        orderId,
        order.payment.razorpayPaymentId,
        order.payment.amount,
        disputeId,
        actorId
      );
    } else if (order.payment) {
      // No razorpay payment ID — flag as failed so it surfaces in the admin queue.
      await this.prisma.payment.update({
        where: { orderId },
        data: {
          refundStatus: RefundStatus.FAILED,
          refundFailureReason: 'No razorpayPaymentId on payment; manual refund required.'
        }
      });
    }
  }

  /**
   * Admin retries a failed dispute refund. Only valid when refundStatus === FAILED.
   */
  async retryDisputeRefund(orderId: string, actorId: string | null) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true, dispute: true }
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} was not found.`);
    }
    if (!order.payment) {
      throw new BadRequestException('Order has no payment to refund.');
    }
    if (order.payment.refundStatus !== RefundStatus.FAILED) {
      throw new BadRequestException(
        `Refund is not in FAILED state (current: ${order.payment.refundStatus}).`
      );
    }
    if (!order.payment.razorpayPaymentId) {
      throw new BadRequestException('Payment has no razorpayPaymentId; cannot auto-refund.');
    }

    // Defense in depth: ask Razorpay if a refund for this payment already exists.
    // Covers the case where a previous attempt actually succeeded at Razorpay but our
    // DB write failed (network blip), leaving us in FAILED locally. Adopting the
    // remote state avoids a second POST and a potential double-refund.
    const existingRefunds = await this.paymentsService.fetchRefundsForPayment(
      order.payment.razorpayPaymentId
    );
    const ours = existingRefunds.find(
      (r) => r.notes?.orderId === orderId && (r.status === 'processed' || r.status === 'pending')
    );
    if (ours) {
      await this.prisma.payment.update({
        where: { orderId },
        data: {
          status: ours.status === 'processed' ? PaymentStatus.REFUNDED : order.payment.status,
          refundStatus: ours.status === 'processed' ? RefundStatus.COMPLETED : RefundStatus.PROCESSING,
          refundCompletedAt: ours.status === 'processed' ? new Date() : null,
          razorpayRefundId: ours.id,
          refundFailureReason: null
        }
      });
      await this.prisma.auditLog.create({
        data: {
          entityType: 'payment',
          entityId: orderId,
          action: 'payment.refund_recovered_from_razorpay',
          actorId,
          metadata: { orderId, razorpayRefundId: ours.id, razorpayStatus: ours.status }
        }
      });
      return this.prisma.payment.findUnique({ where: { orderId } });
    }

    await this.prisma.payment.update({
      where: { orderId },
      data: {
        refundStatus: RefundStatus.PROCESSING,
        refundInitiatedAt: new Date(),
        refundFailureReason: null,
        refundAttempts: { increment: 1 }
      }
    });

    await this.executeAndRecordRefund(
      orderId,
      order.payment.razorpayPaymentId,
      order.payment.amount,
      order.dispute?.id ?? null,
      actorId
    );

    return this.prisma.payment.findUnique({ where: { orderId } });
  }

  /**
   * Admin manually marks a refund as completed (e.g. funds returned out-of-band).
   */
  async completeDisputeRefundManually(orderId: string, actorId: string | null) {
    const payment = await this.prisma.payment.findUnique({ where: { orderId } });
    if (!payment) {
      throw new NotFoundException(`Payment for order ${orderId} not found.`);
    }
    if (payment.refundStatus === RefundStatus.COMPLETED) {
      throw new BadRequestException('Refund already completed.');
    }

    const updated = await this.prisma.payment.update({
      where: { orderId },
      data: {
        status: PaymentStatus.REFUNDED,
        refundStatus: RefundStatus.COMPLETED,
        refundCompletedAt: new Date(),
        refundFailureReason: null
      }
    });

    await this.prisma.auditLog.create({
      data: {
        entityType: 'payment',
        entityId: payment.id,
        action: 'payment.refund_completed_manually',
        actorId,
        metadata: { orderId }
      }
    });

    return updated;
  }

  private async executeAndRecordRefund(
    orderId: string,
    razorpayPaymentId: string,
    amount: number,
    disputeId: string | null,
    actorId: string | null
  ): Promise<void> {
    // Stable key per logical refund intent. Razorpay collapses duplicate POSTs with the
    // same key + same body into the original refund — that's how retries survive a
    // DB-write crash between Razorpay returning 200 and us persisting razorpayRefundId.
    // Do NOT include refundAttempts here; that would defeat idempotency on retry.
    const idempotencyKey = `refund-${orderId}`;

    try {
      const { razorpayRefundId } = await this.paymentsService.executeRefund(
        razorpayPaymentId,
        amount,
        { idempotencyKey, orderId }
      );
      await this.prisma.payment.update({
        where: { orderId },
        data: {
          status: PaymentStatus.REFUNDED,
          refundStatus: RefundStatus.COMPLETED,
          refundCompletedAt: new Date(),
          razorpayRefundId
        }
      });
      await this.prisma.auditLog.create({
        data: {
          entityType: 'payment',
          entityId: orderId,
          action: 'payment.refund_completed',
          actorId,
          metadata: { orderId, disputeId, razorpayRefundId }
        }
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Razorpay refund failed for order ${orderId}: ${reason}`);
      await this.prisma.payment.update({
        where: { orderId },
        data: {
          refundStatus: RefundStatus.FAILED,
          refundFailureReason: reason
        }
      });
      await this.prisma.auditLog.create({
        data: {
          entityType: 'payment',
          entityId: orderId,
          action: 'payment.refund_failed',
          actorId,
          metadata: { orderId, disputeId, reason }
        }
      });
    }
  }

  /**
   * Find disputes that have been OPEN longer than the alert threshold and which
   * have not yet been flagged for admin attention. For each:
   *   - audit-log a `dispute.stale_admin_alert` entry (admins watch the queue)
   *   - if the seller still hasn't responded, send them a reminder push
   *   - mark adminAlertedAt so we don't re-alert on the next tick
   *
   * Resolution is admin-only — this scheduler never auto-resolves a dispute.
   */
  async alertStaleDisputes(alertHours: number): Promise<number> {
    const cutoff = new Date(Date.now() - alertHours * ONE_HOUR_MS);

    const stale = await this.prisma.dispute.findMany({
      where: {
        status: DisputeStatus.OPEN,
        createdAt: { lte: cutoff },
        adminAlertedAt: null
      },
      include: {
        order: {
          include: {
            listing: { include: { brand: true } },
            seller: { select: { id: true } }
          }
        }
      }
    });

    if (stale.length === 0) return 0;

    for (const dispute of stale) {
      await this.prisma.dispute.update({
        where: { id: dispute.id },
        data: { adminAlertedAt: new Date() }
      });

      await this.prisma.auditLog.create({
        data: {
          entityType: 'dispute',
          entityId: dispute.id,
          action: 'dispute.stale_admin_alert',
          actorId: null,
          metadata: {
            orderId: dispute.orderId,
            ageHours: Math.round((Date.now() - dispute.createdAt.getTime()) / ONE_HOUR_MS),
            sellerResponded: Boolean(dispute.sellerResponse)
          }
        }
      });

      if (!dispute.sellerResponse) {
        await this.notificationsService.createNotification({
          userId: dispute.order.seller.id,
          orderId: dispute.orderId,
          listingId: dispute.order.listingId,
          channel: NotificationChannel.PUSH,
          eventType: 'dispute.seller_reminder',
          title: 'Pending dispute on your sale',
          message: `Please respond to the dispute on your ${dispute.order.listing.brand.name} voucher to avoid admin escalation.`,
          metadata: { disputeId: dispute.id }
        });
      }
    }

    return stale.length;
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
    const reminderWindows = VERIFICATION_REMINDER_WINDOWS;

    let sent = 0;

    for (const window of reminderWindows) {
      // Find orders whose deadline falls within a ±VERIFICATION_REMINDER_MATCH_WINDOW_MINUTES band of the reminder point.
      const deadlineFrom = new Date(now.getTime() + (window.minutesBefore - VERIFICATION_REMINDER_MATCH_WINDOW_MINUTES) * ONE_MINUTE_MS);
      const deadlineTo = new Date(now.getTime() + (window.minutesBefore + VERIFICATION_REMINDER_MATCH_WINDOW_MINUTES) * ONE_MINUTE_MS);

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
      const deadline = new Date(Date.now() + windowHours * ONE_HOUR_MS);
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
   * Manually cancel a single PAYMENT_PENDING order (admin escape hatch).
   * Releases the listing back to ACTIVE and marks payment FAILED.
   * Safe to call even if the cron races — conditional updateMany guards against double-cancel.
   */
  async forceCancelOrder(orderId: string, actorId: string): Promise<{ cancelled: boolean; reason: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { listing: { include: { brand: true } }, buyer: { select: { id: true } }, payment: true },
    });

    if (!order) return { cancelled: false, reason: 'Order not found.' };
    if (order.status !== OrderStatus.PAYMENT_PENDING) {
      return { cancelled: false, reason: `Order is ${order.status} — only PAYMENT_PENDING orders can be force-cancelled.` };
    }

    const txResult = await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.PAYMENT_PENDING },
        data: { status: OrderStatus.CANCELLED },
      });

      if (result.count === 0) return { orderCancelled: false, listingReactivated: false };

      const listingUpdate = await tx.voucherListing.updateMany({
        where: { id: order.listingId, status: ListingStatus.RESERVED },
        data: { status: ListingStatus.ACTIVE, buyerId: null },
      });

      if (order.payment) {
        await tx.payment.update({
          where: { orderId },
          data: { status: PaymentStatus.FAILED },
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: 'order',
          entityId: orderId,
          action: 'order.admin_force_cancel',
          actorId,
          metadata: { reason: 'Admin manual force-cancel' },
        },
      });

      return { orderCancelled: true, listingReactivated: listingUpdate.count > 0 };
    });

    if (!txResult.orderCancelled) {
      return { cancelled: false, reason: 'Order transitioned out of PAYMENT_PENDING before cancel could complete.' };
    }

    if (txResult.listingReactivated) {
      this.eventEmitter.emit('listing.updated', { listingId: order.listingId, status: ListingStatus.ACTIVE });
    }

    await this.notificationsService.createMany([{
      userId: order.buyerId,
      orderId,
      listingId: order.listingId,
      channel: NotificationChannel.IN_APP,
      eventType: 'order.payment_timeout',
      title: 'Order cancelled',
      message: `Your ${order.listing.brand.name} reservation was released by support. The listing is available again.`,
      metadata: { reason: 'admin_force_cancel' },
    }]);

    return { cancelled: true, reason: 'Order cancelled and listing released.' };
  }

  /**
   * Cancel orders that have been PAYMENT_PENDING beyond the payment window.
   * Releases the listing back to ACTIVE so other buyers can purchase it.
   * Uses conditional updateMany to safely handle races with the reconciliation job.
   */
  async cancelStalePaymentPendingOrders(timeoutMinutes: number): Promise<number> {
    const cutoff = new Date(Date.now() - timeoutMinutes * ONE_MINUTE_MS);

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
      const txResult = await this.prisma.$transaction(async (tx) => {
        // Conditional update: only proceed if still PAYMENT_PENDING.
        // If reconciliation activated escrow between our read and this write, count = 0.
        const result = await tx.order.updateMany({
          where: { id: order.id, status: OrderStatus.PAYMENT_PENDING },
          data: { status: OrderStatus.CANCELLED }
        });

        if (result.count === 0) return { orderCancelled: false, listingReactivated: false };

        const listingUpdate = await tx.voucherListing.updateMany({
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

        return { orderCancelled: true, listingReactivated: listingUpdate.count > 0 };
      });

      if (txResult.orderCancelled) {
        cancelled++;
        if (txResult.listingReactivated) {
          this.eventEmitter.emit('listing.updated', {
            listingId: order.listingId,
            status: ListingStatus.ACTIVE
          });
        }
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
   * Handle a Razorpay refund webhook event. The refund entity is matched to one of
   * our orders via notes.orderId (we set this when initiating the refund). State
   * convergence: 'processed' → COMPLETED, 'failed' → FAILED, anything else is
   * informational and only records the razorpayRefundId.
   */
  async handleRefundWebhook(
    notes: { orderId?: string } | null,
    refund: {
      id: string;
      status: string;
      error_code?: string;
      error_description?: string;
    }
  ): Promise<void> {
    const orderId = notes?.orderId;
    if (!orderId) {
      this.logger.warn(`Refund webhook ${refund.id} has no notes.orderId — ignoring.`);
      return;
    }

    const data: Record<string, unknown> = { razorpayRefundId: refund.id };
    if (refund.status === 'processed') {
      data.status = PaymentStatus.REFUNDED;
      data.refundStatus = RefundStatus.COMPLETED;
      data.refundCompletedAt = new Date();
      data.refundFailureReason = null;
    } else if (refund.status === 'failed') {
      data.refundStatus = RefundStatus.FAILED;
      data.refundFailureReason = refund.error_description ?? refund.error_code ?? 'refund failed';
    }
    // For 'pending' / 'created' / unknown: only persist the refund id, don't change state.

    const updated = await this.prisma.payment.updateMany({
      where: { orderId, refundStatus: { not: RefundStatus.COMPLETED } },
      data
    });
    if (updated.count === 0) {
      this.logger.warn(`Refund webhook ${refund.id} for orderId=${orderId} did not match any payment row.`);
      return;
    }

    await this.prisma.auditLog.create({
      data: {
        entityType: 'payment',
        entityId: orderId,
        action: `payment.refund_webhook_${refund.status}`,
        actorId: null,
        metadata: { razorpayRefundId: refund.id, status: refund.status }
      }
    });
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
      const listingTransitioned = await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.CANCELLED, confirmedAt: new Date() }
        });

        // Conditional: only flip if listing is still RESERVED. Skip the emit if
        // a concurrent transition already moved it.
        const listingResult = await tx.voucherListing.updateMany({
          where: { id: order.listingId, status: ListingStatus.RESERVED },
          data: { status: ListingStatus.REFUNDED, buyerId: null }
        });

        if (order.payment) {
          await tx.payment.update({
            where: { orderId: order.id },
            data: {
              escrowStatus: EscrowStatus.REFUNDED,
              refundStatus: RefundStatus.PROCESSING,
              refundInitiatedAt: new Date(),
              refundFailureReason: null,
              refundAttempts: { increment: 1 }
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

        return listingResult.count > 0;
      });

      if (listingTransitioned) {
        this.eventEmitter.emit('listing.updated', {
          listingId: order.listingId,
          status: ListingStatus.REFUNDED
        });
      }

      if (order.payment?.razorpayPaymentId) {
        await this.executeAndRecordRefund(
          order.id,
          order.payment.razorpayPaymentId,
          order.payment.amount,
          null,
          null
        );
      } else if (order.payment) {
        await this.prisma.payment.update({
          where: { orderId: order.id },
          data: {
            refundStatus: RefundStatus.FAILED,
            refundFailureReason: 'No razorpayPaymentId on payment; manual refund required.'
          }
        });
      }

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
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.PAYMENT_PENDING },
        data: { status: OrderStatus.ESCROW_ACTIVE }
      });

      if (count === 0) {
        return null;
      }

      const paymentData = {
        amount: order.amount + order.platformFee,
        method: paymentDetails.method,
        status: PaymentStatus.CAPTURED,
        escrowStatus: EscrowStatus.ACTIVE,
        provider,
        currency: order.payment?.currency ?? DEFAULT_CURRENCY,
        capturedAt: new Date(),
        ...(paymentDetails.razorpayOrderId ? { razorpayOrderId: paymentDetails.razorpayOrderId } : {}),
        ...(paymentDetails.razorpayPaymentId ? { razorpayPaymentId: paymentDetails.razorpayPaymentId } : {}),
        ...(paymentDetails.razorpaySignature ? { razorpaySignature: paymentDetails.razorpaySignature } : {})
      };

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

    if (updatedOrder === null) {
      this.logger.log(`activateEscrow no-op: order ${orderId} is already past PAYMENT_PENDING — skipping notifications and emit`);
      return this.prisma.order.findUnique({
        where: { id: orderId },
        include: { payment: true, listing: { include: { brand: true } } }
      });
    }

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
            payoutHoldUntil: true,
            payoutAccount: true
          }
        }
      }
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} was not found.`);
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const orderResult = await tx.order.updateMany({
        where: {
          id,
          status: { in: [OrderStatus.ESCROW_ACTIVE, OrderStatus.CODE_REVEALED, OrderStatus.DISPUTED] }
        },
        data: {
          status,
          confirmedAt
        }
      });
      if (orderResult.count === 0) {
        return null;
      }

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

    if (updatedOrder === null) {
      this.logger.log(`finalizeRelease no-op: order ${id} is already past eligible release states (target: ${status}) — skipping side-effects`);
      return null;
    }

    this.eventEmitter.emit('listing.updated', {
      listingId: order.listingId,
      status: ListingStatus.SOLD
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
    const sellerPayoutHoldUntil = order.seller.payoutHoldUntil;
    const heldUntil =
      sellerPayoutHoldUntil && sellerPayoutHoldUntil > new Date() ? sellerPayoutHoldUntil : null;
    if (heldUntil) {
      this.logger.log(
        `Payout for order ${id} skipped: seller ${order.sellerId} on hold until ${heldUntil.toISOString()}`
      );
      await this.prisma.auditLog.create({
        data: {
          entityType: 'order',
          entityId: id,
          action: 'payout.skipped_held',
          actorId: null,
          metadata: { sellerId: order.sellerId, payoutHoldUntil: heldUntil.toISOString() }
        }
      });
    } else if (order.payment && payoutAccount && fundAccountId && kycVerified && this.paymentsService.isRazorpayXEnabled()) {
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
        // Only flip to FAILED if we don't already have a razorpayPayoutId persisted —
        // protects against a duplicate call returning 4xx after the first succeeded.
        await this.prisma.payment.updateMany({
          where: { orderId: id, razorpayPayoutId: null },
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

}
