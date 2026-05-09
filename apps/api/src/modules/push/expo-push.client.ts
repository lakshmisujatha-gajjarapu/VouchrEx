import { Injectable, Logger } from '@nestjs/common';
import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';

@Injectable()
export class ExpoPushClient {
  private readonly logger = new Logger(ExpoPushClient.name);
  private readonly expo: Expo;

  constructor() {
    const accessToken = process.env.EXPO_ACCESS_TOKEN;
    if (!accessToken && process.env.NODE_ENV === 'production') {
      this.logger.warn('EXPO_ACCESS_TOKEN is not set in production — pushes are spoofable');
    }
    this.expo = new Expo(accessToken ? { accessToken } : {});
  }

  isValidToken(token: string): boolean {
    return Expo.isExpoPushToken(token);
  }

  async sendChunked(messages: readonly ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    const chunks = this.expo.chunkPushNotifications(messages as ExpoPushMessage[]);
    const tickets: ExpoPushTicket[] = [];
    for (const chunk of chunks) {
      try {
        const chunkTickets = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...chunkTickets);
      } catch (error) {
        this.logger.error('Expo push send failed', error);
      }
    }
    return tickets;
  }
}
