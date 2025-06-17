import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserType } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';

import { UserDto } from './dtos/user.dto';
import { UsersService } from './users.service';
import { AdminGuard } from 'src/guards/admin.guard';
import { Pagination } from 'src/dtos/pagination.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { Roles } from 'src/decorators/roles.decorator';
import {
  CurrentUser,
  UserRequestType,
} from './decorators/current-user.decorator';
import { AuthGuard } from 'src/guards/auth.guard';

@ApiTags('User')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserType.Manager, UserType.InternationalDriver, UserType.ParcelCourier)
  async getAllUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ): Promise<Pagination<UserDto>> {
    const users = await this.usersService.findAll({ page });

    return users;
  }

  @Get('/:id')
  @Roles(UserType.Manager, UserType.InternationalDriver, UserType.ParcelCourier)
  findUser(@Param('id', ParseIntPipe) id: number): Promise<UserDto> {
    return this.usersService.findOne(id);
  }

  @Put('/:id')
  @UseGuards(AuthGuard)
  async updateOwnUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserDto,
    @CurrentUser() currentUser: UserRequestType,
  ): Promise<UserDto> {
    // Check if user is updating their own profile or is an admin
    if (currentUser.id !== id && !currentUser.isAdmin) {
      throw new ForbiddenException('You can only update your own profile');
    }

    return this.usersService.update(id, body);
  }

  @Delete('/:id')
  @UseGuards(AdminGuard)
  removeUser(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.usersService.remove(id);
  }
}
