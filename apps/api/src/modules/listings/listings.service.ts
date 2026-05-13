import {
  BadRequestException,
  ConflictException,
  Injectable,
  ForbiddenException,
  NotFoundException
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ListingStatus,
  NotificationChannel,
  OrderStatus,
  Prisma
} from '@prisma/client';

import { DEFAULT_CURRENCY } from '../../common/marketplace.constants';
import { ONE_HOUR_MS } from '../../common/time.constants';
import { AppConfigService } from '../app-config/app-config.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PayoutAccountsService } from '../payouts/payout-accounts.service';
import { BrandsService } from '../brands/brands.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import {
  LISTING_MIN_EXPIRY_HOURS_DEFAULT,
  LISTINGS_PAGE_SIZE_DEFAULT,
  SELLER_MAX_LISTINGS_PER_HOUR_DEFAULT
} from './listings.constants';
import { CodeVaultService } from './services/code-vault.service';
import { computeTier } from '../users/trust-tier';

const editableStatuses: readonly ListingStatus[] = [
  ListingStatus.ACTIVE,
  ListingStatus.DRAFT,
  ListingStatus.VERIFYING
] as const;

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codeVaultService: CodeVaultService,
    private readonly notificationsService: NotificationsService,
    private readonly brandsService: BrandsService,
    private readonly payoutAccountsService: PayoutAccountsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly appConfigService: AppConfigService
  ) {}

  findActive(query: QueryListingsDto) {
    const sort = query.sort ?? 'latest';
    const orderBy =
      sort === 'best-discount'
        ? [{ discountPercent: 'desc' as const }, { createdAt: 'desc' as const }]
        : sort === 'expiring'
          ? [{ expiryDate: 'asc' as const }]
          : sort === 'price-low'
            ? [{ sellingPrice: 'asc' as const }, { createdAt: 'desc' as const }]
            : [{ createdAt: 'desc' as const }];

    return this.prisma.voucherListing.findMany({
      where: {
        status: ListingStatus.ACTIVE,
        expiryDate: { gt: new Date() },
        // Hide listings from BLOCKED-tier sellers (trustScore < 30) per HLD/07.
        seller: { trustScore: { gte: 30 } },
        ...(query.brandId ? { brandId: query.brandId } : {}),
        ...(query.minDiscount ? { discountPercent: { gte: query.minDiscount } } : {}),
        ...(query.maxPrice ? { sellingPrice: { lte: query.maxPrice } } : {}),
        ...(query.category
          ? {
              brand: {
                is: {
                  category: query.category
                }
              }
            }
          : {}),
        ...(query.q
          ? {
              OR: [
                {
                  voucherType: {
                    contains: query.q,
                    mode: 'insensitive'
                  }
                },
                {
                  brand: {
                    is: {
                      name: {
                        contains: query.q,
                        mode: 'insensitive'
                      }
                    }
                  }
                }
              ]
            }
          : {})
      },
      include: {
        brand: true,
        seller: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy,
      take: query.limit ?? LISTINGS_PAGE_SIZE_DEFAULT
    });
  }

  findMine(sellerId: string) {
    return this.prisma.voucherListing.findMany({
      where: { sellerId },
      include: {
        brand: true,
        seller: {
          select: {
            id: true,
            name: true
          }
        },
        order: {
          select: {
            id: true,
            status: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async findOne(id: string) {
    const listing = await this.prisma.voucherListing.findUnique({
      where: { id },
      include: {
        brand: true,
        seller: {
          select: {
            id: true,
            name: true,
            trustScore: true
          }
        }
      }
    });

    if (!listing) {
      throw new NotFoundException(`Listing ${id} was not found.`);
    }

    // Hide listings from BLOCKED-tier sellers from public detail view. Sellers
    // can still see their own via findMine; buyers get a 404 here.
    if (computeTier(listing.seller.trustScore) === 'BLOCKED') {
      throw new NotFoundException(`Listing ${id} was not found.`);
    }

    const { seller, ...rest } = listing;
    return { ...rest, seller: { id: seller.id, name: seller.name } };
  }

  async create(
    createListingDto: CreateListingDto,
    seller: {
      readonly id: string;
      readonly name: string;
    }
  ) {
    // Trust-tier gate: BLOCKED (trustScore < 30) cannot list. Per HLD/07 §Trust Tiers.
    const sellerRow = await this.prisma.user.findUnique({
      where: { id: seller.id },
      select: { trustScore: true }
    });
    if (sellerRow && computeTier(sellerRow.trustScore) === 'BLOCKED') {
      throw new ForbiddenException(
        `Your trust score (${String(sellerRow.trustScore)}) is below the ${String(30)}-point Bronze threshold. Resolve your open disputes to regain listing access.`
      );
    }

    const minExpiryHours = Number(process.env.LISTING_MIN_EXPIRY_HOURS ?? LISTING_MIN_EXPIRY_HOURS_DEFAULT);
    const expiryDate = new Date(createListingDto.expiryDate);
    const minExpiryDate = new Date(Date.now() + minExpiryHours * ONE_HOUR_MS);
    if (expiryDate <= minExpiryDate) {
      throw new BadRequestException(`Voucher must expire at least ${String(minExpiryHours)} hours from now to allow time for buyer verification.`);
    }

    if (createListingDto.sellingPrice >= createListingDto.faceValue) {
      throw new BadRequestException('Selling price must be below face value for resale.');
    }

    const maxPriceInr = await this.appConfigService.getNumber('listing_max_price_inr', 1000);
    if (createListingDto.faceValue > maxPriceInr) {
      throw new BadRequestException(
        `Voucher face value can't exceed ₹${String(maxPriceInr)} right now. Higher limits unlock after extended verification.`
      );
    }

    // Seller must have a registered payout account to receive payments
    const payoutAccount = await this.payoutAccountsService.findByUserId(seller.id);
    if (!payoutAccount) {
      throw new BadRequestException(
        'You must register a payout account (UPI or bank) before listing a voucher. Go to Settings → Payout Account.'
      );
    }

    // Seller velocity: max N listings per hour (HLD fraud rule S1)
    const sellerMaxListingsPerHour = Number(process.env.SELLER_MAX_LISTINGS_PER_HOUR ?? SELLER_MAX_LISTINGS_PER_HOUR_DEFAULT);
    const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS);
    const recentListings = await this.prisma.voucherListing.count({
      where: { sellerId: seller.id, createdAt: { gte: oneHourAgo } }
    });
    if (recentListings >= sellerMaxListingsPerHour) {
      throw new BadRequestException('Too many listings in a short period. Please try again later.');
    }

    const brand = await this.brandsService.resolveForListing({
      ...(createListingDto.brandId ? { brandId: createListingDto.brandId } : {}),
      ...(createListingDto.brandName ? { brandName: createListingDto.brandName } : {})
    });

    // Code uniqueness: reject duplicate voucher codes (DB also enforces codeHash @unique)
    const codeHash = this.codeVaultService.hash(createListingDto.code);
    const existingCode = await this.prisma.codeVault.findUnique({ where: { codeHash } });
    if (existingCode) {
      throw new ConflictException('This voucher code is already listed on VouchrEx.');
    }

    const encrypted = this.codeVaultService.encrypt(createListingDto.code);
    const discountPercent =
      ((createListingDto.faceValue - createListingDto.sellingPrice) / createListingDto.faceValue) *
      100;

    try {
      const createdListing = await this.prisma.voucherListing.create({
        data: {
          sellerId: seller.id,
          brandId: brand.id,
          voucherType: createListingDto.voucherType,
          faceValue: createListingDto.faceValue,
          sellingPrice: createListingDto.sellingPrice,
          discountPercent,
          expiryDate,
          status: ListingStatus.ACTIVE,
          codeVault: {
            create: encrypted
          },
          ...(createListingDto.proofUrl ? { proofUrl: createListingDto.proofUrl } : {})
        },
        include: {
          brand: true,
          seller: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      await this.notificationsService.createNotification({
        userId: seller.id,
        listingId: createdListing.id,
        channel: NotificationChannel.IN_APP,
        eventType: 'listing.created',
        title: 'Listing is live',
        message: `${brand.name} voucher has been listed for ${DEFAULT_CURRENCY} ${String(
          createListingDto.sellingPrice
        )}.`,
        metadata: {
          listingId: createdListing.id,
          brandName: brand.name
        }
      });

      this.eventEmitter.emit('listing.created', {
        listingId: createdListing.id,
        sellerId: createdListing.sellerId,
        brandId: createdListing.brandId,
        status: createdListing.status
      });

      return createdListing;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Duplicate voucher code detected.');
      }

      throw error;
    }
  }

  async update(
    id: string,
    updateListingDto: UpdateListingDto,
    seller: {
      readonly id: string;
      readonly name: string;
    }
  ) {
    const listing = await this.getMutableOwnedListing(id, seller.id);

    const nextFaceValue = updateListingDto.faceValue ?? listing.faceValue;
    const nextSellingPrice = updateListingDto.sellingPrice ?? listing.sellingPrice;

    if (nextSellingPrice >= nextFaceValue) {
      throw new BadRequestException('Selling price must be below face value for resale.');
    }

    const maxPriceInr = await this.appConfigService.getNumber('listing_max_price_inr', 1000);
    if (nextFaceValue > maxPriceInr) {
      throw new BadRequestException(
        `Voucher face value can't exceed ₹${String(maxPriceInr)} right now. Higher limits unlock after extended verification.`
      );
    }

    const nextExpiryDate = updateListingDto.expiryDate
      ? new Date(updateListingDto.expiryDate)
      : listing.expiryDate;
    if (nextExpiryDate <= new Date()) {
      throw new BadRequestException('Expiry date must be in the future.');
    }
    if (updateListingDto.expiryDate) {
      const minExpiryHours = Number(process.env.LISTING_MIN_EXPIRY_HOURS ?? LISTING_MIN_EXPIRY_HOURS_DEFAULT);
      const minExpiryDate = new Date(Date.now() + minExpiryHours * ONE_HOUR_MS);
      if (nextExpiryDate <= minExpiryDate) {
        throw new BadRequestException(
          `Voucher must expire at least ${String(minExpiryHours)} hours from now to allow time for buyer verification.`
        );
      }
    }

    const nextBrand =
      updateListingDto.brandId || updateListingDto.brandName
        ? await this.brandsService.resolveForListing({
            ...(updateListingDto.brandId ? { brandId: updateListingDto.brandId } : {}),
            ...(updateListingDto.brandName ? { brandName: updateListingDto.brandName } : {})
          })
        : listing.brand;

    const discountPercent = ((nextFaceValue - nextSellingPrice) / nextFaceValue) * 100;
    const nextCode = updateListingDto.code?.trim();
    const encrypted = nextCode ? this.codeVaultService.encrypt(nextCode) : null;

    try {
      const updated = await this.prisma.voucherListing.update({
        where: { id: listing.id },
        data: {
          brandId: nextBrand.id,
          ...(updateListingDto.voucherType ? { voucherType: updateListingDto.voucherType } : {}),
          ...(updateListingDto.faceValue ? { faceValue: updateListingDto.faceValue } : {}),
          ...(updateListingDto.sellingPrice ? { sellingPrice: updateListingDto.sellingPrice } : {}),
          ...(updateListingDto.expiryDate ? { expiryDate: nextExpiryDate } : {}),
          ...(updateListingDto.proofUrl ? { proofUrl: updateListingDto.proofUrl } : {}),
          discountPercent,
          ...(encrypted
            ? {
                codeVault: {
                  update: encrypted
                }
              }
            : {})
        },
        include: {
          brand: true,
          seller: {
            select: {
              id: true,
              name: true
            }
          },
          order: {
            select: {
              id: true,
              status: true
            }
          }
        }
      });

      this.eventEmitter.emit('listing.updated', {
        listingId: updated.id,
        status: updated.status
      });

      return updated;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Duplicate voucher code detected.');
      }

      throw error;
    }
  }

  async remove(
    id: string,
    seller: {
      readonly id: string;
    }
  ) {
    const listing = await this.getMutableOwnedListing(id, seller.id);

    const activeOrders = await this.prisma.order.count({
      where: {
        listingId: id,
        status: {
          in: [
            OrderStatus.PAYMENT_PENDING,
            OrderStatus.ESCROW_ACTIVE,
            OrderStatus.CODE_REVEALED,
            OrderStatus.DISPUTED
          ]
        }
      }
    });
    if (activeOrders > 0) {
      throw new BadRequestException('Cannot delete a listing with an active order.');
    }

    await this.prisma.voucherListing.delete({
      where: { id: listing.id }
    });

    return { success: true } as const;
  }

  /**
   * Mark ACTIVE listings as EXPIRED when their voucher expiry date has passed
   * and no buyer has reserved them. Called by ListingsScheduler every 6 hours.
   * Listings with an active order (buyerId set) are never touched — the
   * transaction is in progress and must complete normally.
   */
  async expireStaleListings(): Promise<number> {
    const stale = await this.prisma.voucherListing.findMany({
      where: {
        status: ListingStatus.ACTIVE,
        expiryDate: { lte: new Date() },
        buyerId: null
      },
      select: { id: true }
    });

    if (stale.length === 0) return 0;

    let count = 0;
    const now = new Date();

    for (const listing of stale) {
      // Per-id conditional update: avoids over-emitting if a concurrent
      // process moved the listing out of ACTIVE between our read and write.
      const result = await this.prisma.voucherListing.updateMany({
        where: {
          id: listing.id,
          status: ListingStatus.ACTIVE,
          expiryDate: { lte: now },
          buyerId: null
        },
        data: { status: ListingStatus.EXPIRED }
      });

      if (result.count > 0) {
        count++;
        this.eventEmitter.emit('listing.updated', {
          listingId: listing.id,
          status: ListingStatus.EXPIRED
        });
      }
    }

    return count;
  }

  private async getMutableOwnedListing(id: string, sellerId: string) {
    const listing = await this.prisma.voucherListing.findUnique({
      where: { id },
      include: {
        brand: true,
        order: {
          select: {
            id: true,
            status: true
          }
        },
        codeVault: true
      }
    });

    if (!listing) {
      throw new NotFoundException(`Listing ${id} was not found.`);
    }

    if (listing.sellerId !== sellerId) {
      throw new ForbiddenException('You can only manage your own listings.');
    }

    if (listing.order) {
      throw new ConflictException('This listing already has an order and can no longer be changed.');
    }

    if (!editableStatuses.includes(listing.status)) {
      throw new ConflictException(`Listing ${id} is not editable in status ${listing.status}.`);
    }

    return listing;
  }
}
