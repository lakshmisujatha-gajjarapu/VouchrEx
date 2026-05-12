import { Body, Controller, Get, Headers, Patch, Post } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';

import { sessionHeaderName } from '../auth/auth.constants';
import { AuthService } from '../auth/auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
import { USERS_ROUTES } from './users.routes';

@ApiTags('users')
@Controller(USERS_ROUTES.BASE)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @ApiHeader({ name: sessionHeaderName, required: true })
  @Patch(USERS_ROUTES.ME)
  async updateMe(
    @Body() updateUserDto: UpdateUserDto,
    @Headers(sessionHeaderName) sessionToken?: string,
  ) {
    const user = await this.authService.requireSessionUser(sessionToken);
    return this.usersService.updateMe(user.id, updateUserDto);
  }

  @ApiHeader({ name: sessionHeaderName, required: true })
  @Get(USERS_ROUTES.ME_STATS)
  async getMyStats(@Headers(sessionHeaderName) sessionToken?: string) {
    const user = await this.authService.requireSessionUser(sessionToken);
    return this.usersService.getMyStats(user.id);
  }
}
