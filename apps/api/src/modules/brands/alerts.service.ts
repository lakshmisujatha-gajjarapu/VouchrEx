import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, brandId: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) {
      throw new NotFoundException(`Brand ${brandId} not found.`);
    }

    try {
      return await this.prisma.brandAlert.upsert({
        where: {
          userId_brandId: { userId, brandId }
        },
        update: { active: true },
        create: { userId, brandId }
      });
    } catch (_error) {
      throw new ConflictException('Could not create brand alert.');
    }
  }

  async remove(userId: string, brandId: string) {
    return this.prisma.brandAlert.update({
      where: {
        userId_brandId: { userId, brandId }
      },
      data: { active: false }
    });
  }

  async findAllForUser(userId: string) {
    return this.prisma.brandAlert.findMany({
      where: { userId, active: true },
      include: { brand: true }
    });
  }

  async countForBrand(brandId: string): Promise<number> {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) {
      throw new NotFoundException(`Brand ${brandId} not found.`);
    }
    return this.prisma.brandAlert.count({
      where: { brandId, active: true }
    });
  }
}
