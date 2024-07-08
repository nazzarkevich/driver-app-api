import {
  Body,
  Controller,
  Delete,
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

@ApiTags('User')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserType.Manager, UserType.InternationalDriver, UserType.ParcelCourier)
  async getAllUsers(
    @Query('page', ParseIntPipe) page: number,
  ): Promise<Pagination<UserDto>> {
    try {
      const users = await this.usersService.findAll(page);

      return users;
    } catch (error) {
      throw new Error(error);
    }
  }

  @Get('/:id')
  @Roles(UserType.Manager, UserType.InternationalDriver, UserType.ParcelCourier)
  findUser(@Param('id', ParseIntPipe) id: number): Promise<UserDto> {
    return this.usersService.findOne(id);
  }

  @Put('/:id')
  updateOwnUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserDto,
  ): Promise<UserDto> {
    // TODO: Add permission
    // 1) user can edit their details
    // 2) Admin can edit all users details

    return this.usersService.update(id, body);
  }

  @Delete('/:id')
  @UseGuards(AdminGuard)
  removeUser(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.usersService.remove(id);
  }
}
