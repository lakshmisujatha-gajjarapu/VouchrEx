import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { type NotificationLike, buildPushPayload, shouldPush } from './push.events';
import { PushService } from './push.service';

type NotificationCreatedEvent = {
  readonly userId: string;
  readonly notification: NotificationLike;
  readonly actorUserId?: string;
};

@Injectable()
export class PushDispatcher {
  private readonly logger = new Logger(PushDispatcher.name);

  constructor(private readonly pushService: PushService) {}

  @OnEvent('notification.created')
  async handleNotificationCreated(payload: NotificationCreatedEvent): Promise<void> {
    const { notification, userId, actorUserId } = payload;
    if (!shouldPush(notification.eventType)) return;

    const built = buildPushPayload(notification);
    if (!built) return;

    await this.pushService.sendToUser(userId, {
      ...built,
      eventType: notification.eventType,
      entityId: notification.orderId ?? notification.listingId ?? notification.id,
      dedupeKey: `${userId}:${notification.eventType}:${notification.orderId ?? notification.listingId ?? notification.id}`,
      ...(actorUserId !== undefined ? { actorUserId } : {})
    });
  }
}
