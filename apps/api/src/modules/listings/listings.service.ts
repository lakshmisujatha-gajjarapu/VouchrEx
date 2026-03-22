import {
  BadRequestException,
  ConflictException,
  Injectable,
  ForbiddenException,
  NotFoundException
} from '@nestjs/common';
import {
  ListingStatus,
  NotificationChannel,
  Prisma
} from '@prisma/client';

import { NotificationsService } from '../notifications/notifications.service';
import { PayoutAccountsService } from '../payouts/payout-accounts.service';
import { BrandsService } from '../brands/brands.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { CodeVaultService } from './services/code-vault.service';

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
    private readonly payoutAccountsService: PayoutAccountsService
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
      take: query.limit ?? 20
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
            name: true
          }
        }
      }
    });

    if (!listing) {
      throw new NotFoundException(`Listing ${id} was not found.`);
    }

    return listing;
  }

  async create(
    createListingDto: CreateListingDto,
    seller: {
      readonly id: string;
      readonly name: string;
    }
  ) {
    const minExpiryHours = Number(process.env.LISTING_MIN_EXPIRY_HOURS ?? 48);
    const expiryDate = new Date(createListingDto.expiryDate);
    const minExpiryDate = new Date(Date.now() + minExpiryHours * 60 * 60 * 1000);
    if (expiryDate <= minExpiryDate) {
      throw new BadRequestException(`Voucher must expire at least ${String(minExpiryHours)} hours from now to allow time for buyer verification.`);
    }

    if (createListingDto.sellingPrice >= createListingDto.faceValue) {
      throw new BadRequestException('Selling price must be below face value for resale.');
    }

    // Seller must have a registered payout account to receive payments
    const payoutAccount = await this.payoutAccountsService.findByUserId(seller.id);
    if (!payoutAccount) {
      throw new BadRequestException(
        'You must register a payout account (UPI or bank) before listing a voucher. Go to Settings → Payout Account.'
      );
    }

    // Seller velocity: max N listings per hour (HLD fraud rule S1)
    const sellerMaxListingsPerHour = Number(process.env.SELLER_MAX_LISTINGS_PER_HOUR ?? 5);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
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
        message: `${brand.name} voucher has been listed for INR ${String(
          createListingDto.sellingPrice
        )}.`,
        metadata: {
          listingId: createdListing.id,
          brandName: brand.name
        }
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

    const nextExpiryDate = updateListingDto.expiryDate
      ? new Date(updateListingDto.expiryDate)
      : listing.expiryDate;
    if (nextExpiryDate <= new Date()) {
      throw new BadRequestException('Expiry date must be in the future.');
    }
    if (updateListingDto.expiryDate) {
      const minExpiryDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      if (nextExpiryDate <= minExpiryDate) {
        throw new BadRequestException('Voucher must expire at least 48 hours from now to allow time for buyer verification.');
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
      return await this.prisma.voucherListing.update({
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

    const { count } = await this.prisma.voucherListing.updateMany({
      where: { id: { in: stale.map((l) => l.id) } },
      data: { status: ListingStatus.EXPIRED }
    });

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
