import { Controller, Get, Post, Delete, Param, Headers } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { sessionHeaderName } from '../auth/auth.constants';
import { AlertsService } from './alerts.service';

@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly authService: AuthService,
    private readonly alertsService: AlertsService
  ) {}

  @ApiHeader({
    name: sessionHeaderName,
    required: true,
    description: 'Session token.'
  })
  @Get()
  async findAll(@Headers(sessionHeaderName) sessionToken?: string) {
    const user = await this.authService.requireSessionUser(sessionToken);
    return this.alertsService.findAllForUser(user.id);
  }

  @ApiHeader({
    name: sessionHeaderName,
    required: true,
    description: 'Session token.'
  })
  @Post(':brandId')
  async create(
    @Param('brandId') brandId: string,
    @Headers(sessionHeaderName) sessionToken?: string
  ) {
    const user = await this.authService.requireSessionUser(sessionToken);
    return this.alertsService.create(user.id, brandId);
  }

  @ApiHeader({
    name: sessionHeaderName,
    required: true,
    description: 'Session token.'
  })
  @Delete(':brandId')
  async remove(
    @Param('brandId') brandId: string,
    @Headers(sessionHeaderName) sessionToken?: string
  ) {
    const user = await this.authService.requireSessionUser(sessionToken);
    return this.alertsService.remove(user.id, brandId);
  }
}
