import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  NotificationChannel,
  NotificationStatus,
  Prisma
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

type CreateNotificationInput = {
  readonly userId?: string;
  readonly orderId?: string;
  readonly listingId?: string;
  readonly eventType: string;
  readonly title: string;
  readonly message: string;
  readonly channel?: NotificationChannel;
  readonly metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async createNotification(input: CreateNotificationInput) {
    const channel = input.channel ?? NotificationChannel.PUSH;
    const status =
      channel === NotificationChannel.IN_APP
        ? NotificationStatus.SENT
        : NotificationStatus.PENDING;

    const notification = await this.prisma.notification.create({
      data: {
        eventType: input.eventType,
        title: input.title,
        message: input.message,
        channel,
        status,
        ...(input.userId ? { userId: input.userId } : {}),
        ...(input.orderId ? { orderId: input.orderId } : {}),
        ...(input.listingId ? { listingId: input.listingId } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
        ...(status === NotificationStatus.SENT ? { sentAt: new Date() } : {})
      }
    });

    if (input.userId) {
      this.eventEmitter.emit('notification.created', {
        userId: input.userId,
        notification
      });
    }

    return notification;
  }

  async createMany(inputs: readonly CreateNotificationInput[]) {
    const results = [];
    for (const input of inputs) {
      results.push(await this.createNotification(input));
    }
    return results;
  }

  listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async clearOne(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) {
      throw new NotFoundException(`Notification ${notificationId} was not found.`);
    }
    await this.prisma.notification.delete({ where: { id: notificationId } });
  }

  async clearAll(userId: string) {
    await this.prisma.notification.deleteMany({ where: { userId } });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, status: { not: NotificationStatus.READ } },
      data: { status: NotificationStatus.READ, readAt: new Date(), sentAt: new Date() }
    });
  }

  async markRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId
      }
    });

    if (!notification) {
      throw new NotFoundException(`Notification ${notificationId} was not found.`);
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
        sentAt: notification.sentAt ?? new Date()
      }
    });
  }
}
