import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';

@Injectable()
export class MarketingService {
  constructor(private readonly prisma: PrismaService) {}

  async createPromotion(dto: CreatePromotionDto) {
    return this.prisma.promotionWindow.create({
      data: {
        name: dto.name,
        startTime: dto.startTime,
        endTime: dto.endTime,
        category: dto.category ?? null,
        minInventory: dto.minInventory,
        pushMessage: dto.pushMessage,
        active: dto.active
      }
    });
  }

  async findAllPromotions() {
    return this.prisma.promotionWindow.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async removePromotion(id: string) {
    return this.prisma.promotionWindow.delete({ where: { id } });
  }

  async getDealAvailability() {
    const categories = await this.prisma.brand.findMany({
      select: { category: true },
      distinct: ['category']
    });

    const availability = await Promise.all(
      categories.map(async ({ category }) => {
        const count = await this.prisma.voucherListing.count({
          where: {
            status: 'ACTIVE',
            expiryDate: { gt: new Date() },
            brand: { category }
          }
        });
        return { category, count };
      })
    );

    return availability;
  }
}
