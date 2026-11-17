import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
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
import { Permission, getAllowedAppsForUser } from 'src/permissions/permissions';
import { UpdateUserRoleDto } from './dtos/update-user-role.dto';
import { ApproveStaffDto } from './dtos/register-staff.dto';
import { resolveBusinessScope } from 'src/common/business-scope';

@ApiTags('User')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  async updateMyProfile(
    @Body() body: Record<string, unknown>,
    @CurrentUser() currentUser: UserRequestType,
  ) {
    const user = await this.usersService.updateSelf(currentUser, body);
    return { ...user, allowedApps: getAllowedAppsForUser(currentUser) };
  }

  @Get()
  @Permissions(Permission.USER_READ)
  async getAllUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @CurrentUser() currentUser: UserRequestType,
  ): Promise<Pagination<UserDto>> {
    const users = await this.usersService.findAll({ page, currentUser });

    return users;
  }

  @Get('pending-staff')
  @Permissions(Permission.USER_ROLE_UPDATE)
  pendingStaff(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('search') search: string,
    @CurrentUser() actor: UserRequestType,
    @Query('type') type?: string,
    @Query('businessId') businessId?: string,
  ) {
    if (type !== undefined && type !== 'driver' && type !== 'courier')
      throw new BadRequestException('Invalid carrier type');
    return this.usersService.pendingStaff(
      Math.max(1, page),
      search,
      { ...actor, businessId: resolveBusinessScope(actor, businessId) },
      type as 'driver' | 'courier' | undefined,
    );
  }

  @Post(':id/approve-staff')
  @Permissions(Permission.USER_ROLE_UPDATE)
  approveStaff(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ApproveStaffDto,
    @CurrentUser() actor: UserRequestType,
    @Query('businessId') businessId?: string,
  ) {
    if (resolveBusinessScope(actor, businessId) !== actor.businessId)
      throw new ForbiddenException('Manage staff in your own business');
    return this.usersService.approveStaff(id, body.type, actor);
  }

  @Get('/:id')
  @Permissions(Permission.USER_READ)
  findUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: UserRequestType,
  ): Promise<UserDto> {
    return this.usersService.findOne(
      id,
      { phoneNumber: true, driverProfile: true, courierProfile: true },
      actor,
    );
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

  @Patch('/:id/role')
  @Permissions(Permission.USER_ROLE_UPDATE)
  updateUserRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserRoleDto,
    @CurrentUser() currentUser: UserRequestType,
    @Query('businessId') businessId?: string,
  ): Promise<UserDto> {
    if (
      resolveBusinessScope(currentUser, businessId) !== currentUser.businessId
    )
      throw new ForbiddenException('Manage staff in your own business');
    return this.usersService.updateRole(id, body.type, currentUser);
  }

  @Delete('/:id')
  @Permissions(Permission.USER_DELETE)
  removeUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: UserRequestType,
  ): Promise<void> {
    return this.usersService.remove(id, actor);
  }
}
