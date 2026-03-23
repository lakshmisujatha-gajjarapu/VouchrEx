import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';

import { AuthService } from '../auth/auth.service';

export type NotificationCreatedEvent = {
  readonly userId: string;
  readonly notification: unknown;
};

export type OrderUpdatedEvent = {
  readonly buyerId: string;
  readonly sellerId: string;
  readonly orderId: string;
  readonly status: string;
};

@WebSocketGateway({
  cors: { origin: '*' },
  transports: ['websocket']
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  readonly server!: Server;

  constructor(private readonly authService: AuthService) {}

  async handleConnection(socket: Socket) {
    const token = socket.handshake.auth['token'] as string | undefined;
    const user = await this.authService.getSessionUser(token);

    if (!user) {
      socket.disconnect(true);
      return;
    }

    (socket.data as Record<string, unknown>)['userId'] = user.id;
    await socket.join(`user:${user.id}`);
  }

  handleDisconnect(_socket: Socket) {
    // Socket.IO auto-cleans rooms on disconnect
  }

  @OnEvent('notification.created')
  handleNotificationCreated(payload: NotificationCreatedEvent) {
    this.server.to(`user:${payload.userId}`).emit('notification:new', payload.notification);
  }

  @OnEvent('order.updated')
  handleOrderUpdated(payload: OrderUpdatedEvent) {
    const data = { orderId: payload.orderId, status: payload.status };
    this.server.to(`user:${payload.buyerId}`).emit('order:updated', data);
    this.server.to(`user:${payload.sellerId}`).emit('order:updated', data);
  }
}
