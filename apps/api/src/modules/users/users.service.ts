import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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
}
