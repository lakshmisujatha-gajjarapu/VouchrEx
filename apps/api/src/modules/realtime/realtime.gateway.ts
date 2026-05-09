import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';

import { AdminAccessService } from '../admin/admin-access.service';
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

export type ListingCreatedEvent = {
  readonly listingId: string;
  readonly sellerId: string;
  readonly brandId: string;
  readonly status: string;
};

export type ListingUpdatedEvent = {
  readonly listingId: string;
  readonly status: string;
};

export type DisputeCreatedEvent = {
  readonly orderId: string;
  readonly listingId: string;
  readonly buyerId: string;
  readonly sellerId: string;
  readonly raisedByUserId: string;
};

@WebSocketGateway({
  cors: { origin: '*' },
  transports: ['websocket']
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  readonly server!: Server;

  constructor(
    private readonly authService: AuthService,
    private readonly adminAccessService: AdminAccessService
  ) {}

  async handleConnection(socket: Socket) {
    const token = socket.handshake.auth['token'] as string | undefined;
    if (!token) {
      socket.disconnect(true);
      return;
    }

    const user = await this.authService.getSessionUser(token);
    if (user) {
      (socket.data as Record<string, unknown>)['userId'] = user.id;
      await socket.join(`user:${user.id}`);
      return;
    }

    const adminIdentity = await this.adminAccessService.resolveIdentity(token);
    if (adminIdentity) {
      (socket.data as Record<string, unknown>)['adminId'] = adminIdentity.adminId;
      await socket.join('admin');
      return;
    }

    socket.disconnect(true);
  }

  handleDisconnect(_socket: Socket) {
    // Socket.IO auto-cleans rooms on disconnect
  }

  async isUserConnected(userId: string): Promise<boolean> {
    const sockets = await this.server.in(`user:${userId}`).fetchSockets();
    return sockets.length > 0;
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
    this.server.to('admin').emit('order:updated', data);
  }

  @OnEvent('dispute.created')
  handleDisputeCreated(payload: DisputeCreatedEvent) {
    this.server.to('admin').emit('dispute:opened', {
      orderId: payload.orderId,
      listingId: payload.listingId
    });
  }

  @OnEvent('listing.created')
  handleListingCreated(payload: ListingCreatedEvent) {
    this.server.emit('listing:created', payload);
  }

  @OnEvent('listing.updated')
  handleListingUpdated(payload: ListingUpdatedEvent) {
    this.server.emit('listing:updated', payload);
  }
}
