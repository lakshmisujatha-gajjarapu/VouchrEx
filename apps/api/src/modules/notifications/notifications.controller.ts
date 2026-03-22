import { Controller, Delete, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';

import { AuthService } from '../auth/auth.service';
import { sessionHeaderName } from '../auth/auth.constants';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiHeader({
  name: sessionHeaderName,
  required: true,
  description: 'Session token returned from OTP verification.'
})
@Controller('notifications')
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

  @Delete()
  async clearAll(@Headers(sessionHeaderName) sessionToken?: string) {
    const user = await this.authService.requireSessionUser(sessionToken);
    await this.notificationsService.clearAll(user.id);
  }

  @Post('read-all')
  async markAllRead(@Headers(sessionHeaderName) sessionToken?: string) {
    const user = await this.authService.requireSessionUser(sessionToken);
    await this.notificationsService.markAllRead(user.id);
  }

  @Post(':id/read')
  async markRead(
    @Param('id') notificationId: string,
    @Headers(sessionHeaderName) sessionToken?: string
  ) {
    const user = await this.authService.requireSessionUser(sessionToken);
    return this.notificationsService.markRead(notificationId, user.id);
  }
}
