import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Brand } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { collapseBrandNameWhitespace, normalizeBrandName } from './brand-name';
import { starterCatalog } from './starter-catalog';

const userBrandDefaults = {
  category: 'Other',
  avgDiscountPercent: 0,
  verificationWindowHours: 2,
  autoVerifyEnabled: false,
  active: true
} as const;

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(input?: {
    readonly q?: string;
    readonly limit?: number;
  }) {
    const q = collapseBrandNameWhitespace(input?.q ?? '');
    const normalizedQuery = q ? normalizeBrandName(q) : '';
    const take = Math.max(1, Math.min(input?.limit ?? (q ? 8 : 100), q ? 20 : 200));

    const brands = await this.prisma.brand.findMany({
      where: {
        active: true,
        ...(normalizedQuery
          ? {
              OR: [
                {
                  normalizedName: {
                    contains: normalizedQuery
                  }
                },
                {
                  name: {
                    contains: q,
                    mode: 'insensitive'
                  }
                }
              ]
            }
          : {})
      },
      orderBy: { name: 'asc' },
      take: normalizedQuery ? take * 3 : take
    });

    if (!normalizedQuery) {
      return brands;
    }

    return brands
      .sort((left, right) => {
        const leftScore = this.getSuggestionScore(left, normalizedQuery);
        const rightScore = this.getSuggestionScore(right, normalizedQuery);
        return rightScore - leftScore || left.name.localeCompare(right.name);
      })
      .slice(0, take);
  }

  async findOne(id: string): Promise<Brand> {
    const brand = await this.prisma.brand.findUnique({
      where: { id, active: true }
    });
    if (!brand) {
      throw new NotFoundException(`Brand ${id} was not found.`);
    }
    return brand;
  }

  async seedDefaults() {
    await this.prisma.$transaction(
      starterCatalog.map((brand) => {
        const seededBrand = {
          ...brand,
          normalizedName: normalizeBrandName(brand.name)
        };

        return this.prisma.brand.upsert({
          where: { normalizedName: seededBrand.normalizedName },
          update: seededBrand,
          create: seededBrand
        });
      })
    );

    return this.findAll();
  }

  async resolveForListing(input: {
    readonly brandId?: string;
    readonly brandName?: string;
  }): Promise<Brand> {
    const brandId = input.brandId?.trim();
    if (brandId) {
      const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });

      if (!brand || !brand.active) {
        throw new NotFoundException(`Brand ${brandId} was not found or inactive.`);
      }

      return brand;
    }

    const brandName = collapseBrandNameWhitespace(input.brandName ?? '');
    if (!brandName) {
      throw new BadRequestException('brandName is required when brandId is not provided.');
    }

    const normalizedName = normalizeBrandName(brandName);
    const existing = await this.prisma.brand.findUnique({
      where: { normalizedName }
    });

    if (existing) {
      if (existing.active) {
        return existing;
      }

      return this.prisma.brand.update({
        where: { id: existing.id },
        data: { active: true }
      });
    }

    try {
      return await this.prisma.brand.create({
        data: {
          name: brandName,
          normalizedName,
          ...userBrandDefaults
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const brand = await this.prisma.brand.findUnique({
          where: { normalizedName }
        });

        if (brand) {
          return brand.active
            ? brand
            : this.prisma.brand.update({
                where: { id: brand.id },
                data: { active: true }
              });
        }
      }

      throw error;
    }
  }

  private getSuggestionScore(brand: Brand, normalizedQuery: string) {
    if (brand.normalizedName === normalizedQuery) {
      return 400;
    }

    if (brand.normalizedName.startsWith(normalizedQuery)) {
      return 300;
    }

    if (brand.normalizedName.includes(normalizedQuery)) {
      return 200;
    }

    return 100;
  }
}
