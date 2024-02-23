import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UserType } from '@prisma/client';

import { UsersService } from './users.service';
import { UpdateUserDto } from './dtos/update-user.dto';
import { Roles } from 'src/decorators/roles.decorator';
import { AdminGuard } from 'src/guards/admin.guard';

// TODO: Investigate @nestjs/swagger -> pagination

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserType.Manager, UserType.InternationalDriver, UserType.ParcelCourier)
  async getAllUsers() {
    try {
      const users = await this.usersService.findAll();

      return users;
    } catch (error) {
      throw new Error(error);
    }
  }

  @Get('/:id')
  @Roles(UserType.Manager, UserType.InternationalDriver, UserType.ParcelCourier)
  findUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Put('/:id')
  updateOwnUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserDto,
  ) {
    // TODO: Add permission
    // 1) user can edit their details
    // 2) Admin can edit all users details

    return this.usersService.update(id, body);
  }

  @Delete()
  @UseGuards(AdminGuard)
  removeUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
