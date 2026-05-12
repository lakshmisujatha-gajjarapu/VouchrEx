import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { computeTier } from './trust-tier';

const meSelect = {
  id: true,
  phone: true,
  name: true,
  email: true,
  status: true,
  tier: true,
  totalSales: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  create(createUserDto: CreateUserDto) {
    return this.prisma.user.create({
      data: {
        phone: createUserDto.phone,
        name: createUserDto.name,
        email: createUserDto.email ?? null
      }
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  updateMe(userId: string, dto: UpdateUserDto) {
    const data: { name?: string; email?: string | null } = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: meSelect,
    });
  }

  async getMyStats(userId: string) {
    const [user, disputesRaised, purchases] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          trustScore: true,
          tier: true,
          totalSales: true,
          disputeCount: true,
          sellerStrikes: true,
          buyerStrikes: true,
          payoutHoldUntil: true,
        },
      }),
      this.prisma.dispute.count({ where: { raisedById: userId } }),
      this.prisma.order.count({ where: { buyerId: userId } }),
    ]);

    if (!user) throw new NotFoundException('User not found.');

    const tier = computeTier(user.trustScore);
    const nextTierAt =
      tier === 'BLOCKED' ? 30 :
      tier === 'BRONZE' ? 50 :
      tier === 'SILVER' ? 80 :
      null;

    return {
      trustScore: user.trustScore,
      tier,
      nextTierAt,
      totalSales: user.totalSales,
      purchases,
      disputesAgainst: user.disputeCount,
      disputesRaised,
      sellerStrikes: user.sellerStrikes,
      buyerStrikes: user.buyerStrikes,
      payoutHoldUntil: user.payoutHoldUntil ? user.payoutHoldUntil.toISOString() : null,
    };
  }
}
