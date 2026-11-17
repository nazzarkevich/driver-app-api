import { resolveBusinessScope } from 'src/common/business-scope';
import {
  Body,
  ForbiddenException,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';

import { DriversService } from './drivers.service';
import { Pagination } from 'src/dtos/pagination.dto';
import { DriverProfileDto } from './dtos/driver-profile.dto';
import { CreateDriverProfileDto } from './dtos/create-driver-profile.dto';
import { CreateDriverWithUserDto } from './dtos/create-driver-with-user.dto';
import { UpdateDriverProfileDto } from './dtos/update-driver-profile.dto';
import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';
import { Permissions } from 'src/decorators/permissions.decorator';
import { Permission } from 'src/permissions/permissions';
import { canManageStaff } from 'src/users/staff-access';

@ApiTags('Driver')
@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post()
  @Permissions(Permission.DRIVER_PROFILE_CREATE)
  async createDriverProfile(
    @Body() body: CreateDriverProfileDto,
    @CurrentUser() actor: UserRequestType,
  ): Promise<void> {
    return this.driversService.createProfile(body, actor.businessId);
  }

  @Post('create-with-user')
  @Permissions(Permission.DRIVER_PROFILE_CREATE)
  @ApiOperation({ summary: 'Create a new driver with user profile' })
  @ApiBody({
    type: CreateDriverWithUserDto,
    examples: {
      'new-driver': {
        summary: 'New Driver',
        value: {
          firstName: 'John',
          lastName: 'Doe',
          phoneNumber: '501234567',
          phoneCountryCode: '+38',
          email: 'john.doe@example.com',
          password: 'securePassword123',
        },
      },
    },
  })
  async createDriverWithUser(
    @CurrentUser() currentUser: UserRequestType,
    @Body() body: CreateDriverWithUserDto,
    @Query('businessId') businessId?: string,
  ): Promise<DriverProfileDto> {
    if (
      resolveBusinessScope(currentUser, businessId) !== currentUser.businessId
    )
      throw new ForbiddenException('Manage staff in your own business');
    if (!canManageStaff(currentUser))
      throw new ForbiddenException(
        'Only managers and admins can create staff accounts',
      );
    return this.driversService.createProfileWithUser(
      body,
      currentUser.businessId,
    );
  }

  @Get()
  @Permissions(Permission.DRIVER_PROFILE_READ)
  async getAllDriversProfiles(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @CurrentUser() currentUser: UserRequestType,
  ): Promise<Pagination<DriverProfileDto>> {
    return this.driversService.findAll(page, currentUser);
  }

  @Get('/:id')
  @Permissions(Permission.DRIVER_PROFILE_READ)
  async getDriverProfile(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: UserRequestType,
    @Query('businessId') businessId?: string,
  ): Promise<DriverProfileDto> {
    return this.driversService.findOne(
      id,
      resolveBusinessScope(currentUser, businessId),
    );
  }

  @Put('/:id')
  @Permissions(Permission.DRIVER_PROFILE_UPDATE)
  async updateDriverProfile(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateDriverProfileDto,
    @CurrentUser() actor: UserRequestType,
    @Query('businessId') businessId?: string,
  ): Promise<DriverProfileDto> {
    if (!canManageStaff(actor))
      throw new ForbiddenException('Only managers and admins can update staff');
    if (resolveBusinessScope(actor, businessId) !== actor.businessId)
      throw new ForbiddenException('Manage staff in your own business');
    return this.driversService.update(id, body, actor.businessId);
  }

  @Patch('/:id/block')
  @Permissions(Permission.DRIVER_PROFILE_BLOCK)
  async toggleBlockDriver(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: UserRequestType,
    @Query('businessId') businessId?: string,
  ): Promise<DriverProfileDto> {
    if (!currentUser.isAdmin && !currentUser.isSuperAdmin)
      throw new ForbiddenException('Only admins can block staff');
    if (
      resolveBusinessScope(currentUser, businessId) !== currentUser.businessId
    )
      throw new ForbiddenException('Manage staff in your own business');
    return this.driversService.toggleBlock(id, currentUser);
  }

  @Delete(':id')
  @Permissions(Permission.DRIVER_PROFILE_DELETE)
  removeDriverProfile(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: UserRequestType,
  ): Promise<void> {
    return this.driversService.remove(id, actor.businessId);
  }
}
