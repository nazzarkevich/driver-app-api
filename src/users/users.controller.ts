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
import { ApiTags } from '@nestjs/swagger';

import { UserDto } from './dtos/user.dto';
import { UsersService } from './users.service';
import { Pagination } from 'src/dtos/pagination.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import {
  CurrentUser,
  UserRequestType,
} from './decorators/current-user.decorator';
import { SupabaseAuthGuard } from 'src/guards/supabase-auth.guard';
import { Permissions } from 'src/decorators/permissions.decorator';
import { Permission } from 'src/permissions/permissions';

@ApiTags('User')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions(Permission.USER_READ)
  async getAllUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ): Promise<Pagination<UserDto>> {
    const users = await this.usersService.findAll({ page });

    return users;
  }

  @Get('/:id')
  @Permissions(Permission.USER_READ)
  findUser(@Param('id', ParseIntPipe) id: number): Promise<UserDto> {
    return this.usersService.findOne(id);
  }

  @Put('/:id')
  @UseGuards(SupabaseAuthGuard)
  async updateOwnUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserDto,
    @CurrentUser() currentUser: UserRequestType,
  ): Promise<UserDto> {
    // Check if user is updating their own profile or is an admin
    if (currentUser.id !== id && !currentUser.isAdmin) {
      throw new ForbiddenException('You can only update your own profile');
    }

    return this.usersService.update(id, body, currentUser);
  }

  @Delete('/:id')
  @Permissions(Permission.USER_DELETE)
  removeUser(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.usersService.remove(id);
  }
}
