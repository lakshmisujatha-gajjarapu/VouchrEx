import { Controller, Delete, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';

import { AuthService } from '../auth/auth.service';
import { sessionHeaderName } from '../auth/auth.constants';
import { NotificationsService } from './notifications.service';
import { NOTIFICATIONS_ROUTES } from './notifications.routes';

@ApiTags('notifications')
@ApiHeader({
  name: sessionHeaderName,
  required: true,
  description: 'Session token returned from OTP verification.'
})
@Controller(NOTIFICATIONS_ROUTES.BASE)
export class NotificationsController {
  constructor(
    private readonly authService: AuthService,
    private readonly notificationsService: NotificationsService
  ) {}

  @Get()
  async listMine(@Headers(sessionHeaderName) sessionToken?: string) {
    const user = await this.authService.requireSessionUser(sessionToken);
    return this.notificationsService.listForUser(user.id);
  }

  @Delete(NOTIFICATIONS_ROUTES.BY_ID)
  async clearOne(
    @Param('id') notificationId: string,
    @Headers(sessionHeaderName) sessionToken?: string
  ) {
    const user = await this.authService.requireSessionUser(sessionToken);
    await this.notificationsService.clearOne(notificationId, user.id);
    return { success: true };
  }

  @Delete()
  async clearAll(@Headers(sessionHeaderName) sessionToken?: string) {
    const user = await this.authService.requireSessionUser(sessionToken);
    await this.notificationsService.clearAll(user.id);
    return { success: true };
  }

  @Post(NOTIFICATIONS_ROUTES.READ_ALL)
  async markAllRead(@Headers(sessionHeaderName) sessionToken?: string) {
    const user = await this.authService.requireSessionUser(sessionToken);
    await this.notificationsService.markAllRead(user.id);
    return { success: true };
  }

  @Post(NOTIFICATIONS_ROUTES.BY_ID_READ)
  async markRead(
    @Param('id') notificationId: string,
    @Headers(sessionHeaderName) sessionToken?: string
  ) {
    const user = await this.authService.requireSessionUser(sessionToken);
    return this.notificationsService.markRead(notificationId, user.id);
  }
}
