import { Injectable, Logger } from '@nestjs/common';
import { type ExpoPushMessage } from 'expo-server-sdk';

import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ExpoPushClient } from './expo-push.client';
import { EXPO_DEAD_TOKEN_ERRORS, PUSH_DEDUP_TTL_MS } from './push.constants';

export type SendPushPayload = {
  readonly title: string;
  readonly body: string;
  readonly link: string;
  readonly eventType: string;
  readonly entityId: string;
  readonly dedupeKey: string;
  readonly actorUserId?: string;
};

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly dedupCache = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly expoClient: ExpoPushClient,
    private readonly realtimeGateway: RealtimeGateway
  ) {}

  async sendToUser(userId: string, payload: SendPushPayload): Promise<void> {
    if (this.shouldSkipForActor(userId, payload)) return;
    if (this.shouldSkipForDedup(payload.dedupeKey)) return;
    if (await this.shouldSkipForForeground(userId)) {
      this.logger.debug(`Skip push (foreground): user=${userId} event=${payload.eventType}`);
      return;
    }

    const tokens = await this.prisma.pushToken.findMany({ where: { userId } });
    if (tokens.length === 0) return;

    const messages: ExpoPushMessage[] = tokens
      .filter((t) => this.expoClient.isValidToken(t.token))
      .map((t) => ({
        to: t.token,
        title: payload.title,
        body: payload.body,
        sound: 'default',
        priority: 'high',
        data: {
          link: payload.link,
          eventType: payload.eventType,
          entityId: payload.entityId
        }
      }));

    if (messages.length === 0) return;

    const tickets = await this.expoClient.sendChunked(messages);

    await this.cleanupDeadTokens(tickets, tokens);

    this.logger.log(
      `Push sent: user=${userId} event=${payload.eventType} tokens=${String(tokens.length)} tickets=${String(tickets.length)}`
    );
  }

  private shouldSkipForActor(userId: string, payload: SendPushPayload): boolean {
    return payload.actorUserId === userId;
  }

  private shouldSkipForDedup(dedupeKey: string): boolean {
    const now = Date.now();
    this.purgeExpiredDedupEntries(now);
    if (this.dedupCache.has(dedupeKey)) return true;
    this.dedupCache.set(dedupeKey, now + PUSH_DEDUP_TTL_MS);
    return false;
  }

  private purgeExpiredDedupEntries(now: number): void {
    for (const [key, expiresAt] of this.dedupCache) {
      if (expiresAt <= now) this.dedupCache.delete(key);
    }
  }

  private async shouldSkipForForeground(userId: string): Promise<boolean> {
    return this.realtimeGateway.isUserConnected(userId);
  }

  private async cleanupDeadTokens(
    tickets: readonly { status?: string; details?: { error?: string } }[],
    tokens: readonly { id: string; token: string }[]
  ): Promise<void> {
    const deadTokenIds: string[] = [];
    tickets.forEach((ticket, i) => {
      const error = ticket.details?.error;
      const token = tokens[i];
      if (
        token &&
        ticket.status === 'error' &&
        EXPO_DEAD_TOKEN_ERRORS.includes(error as (typeof EXPO_DEAD_TOKEN_ERRORS)[number])
      ) {
        deadTokenIds.push(token.id);
      }
    });
    if (deadTokenIds.length > 0) {
      await this.prisma.pushToken.deleteMany({ where: { id: { in: deadTokenIds } } });
      this.logger.log(`Cleaned up ${String(deadTokenIds.length)} dead push tokens`);
    }
  }

  __clearDedupForTests(): void {
    this.dedupCache.clear();
  }
}
