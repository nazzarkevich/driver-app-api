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

import { CouriersService } from './couriers.service';
import { Pagination } from 'src/dtos/pagination.dto';
import { CourierProfileDto } from './dtos/courier-profile.dto';
import { CreateCourierProfileDto } from './dtos/create-courier-profile.dto';
import { CreateCourierWithUserDto } from './dtos/create-courier-with-user.dto';
import { UpdateCourierProfileDto } from './dtos/update-courier-profile.dto';
import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';
import { Permissions } from 'src/decorators/permissions.decorator';
import { Permission } from 'src/permissions/permissions';
import { canManageStaff } from 'src/users/staff-access';

@ApiTags('Courier')
@Controller('couriers')
export class CouriersController {
  constructor(private readonly couriersService: CouriersService) {}

  @Post()
  @Permissions(Permission.COURIER_PROFILE_CREATE)
  async createCourierProfile(
    @Body() body: CreateCourierProfileDto,
    @CurrentUser() actor: UserRequestType,
  ): Promise<void> {
    return this.couriersService.createProfile(body, actor.businessId);
  }

  @Post('create-with-user')
  @Permissions(Permission.COURIER_PROFILE_CREATE)
  @ApiOperation({ summary: 'Create a new courier with user profile' })
  @ApiBody({
    type: CreateCourierWithUserDto,
    examples: {
      'new-courier': {
        summary: 'New Courier',
        value: {
          firstName: 'John',
          lastName: 'Doe',
          phoneNumber: '501234567',
          phoneCountryCode: '+38',
          email: 'john.doe@example.com',
          password: 'securePassword123',
          country: 'UA',
          city: 'Kyiv',
        },
      },
    },
  })
  async createCourierWithUser(
    @CurrentUser() currentUser: UserRequestType,
    @Body() body: CreateCourierWithUserDto,
    @Query('businessId') businessId?: string,
  ): Promise<CourierProfileDto> {
    if (
      resolveBusinessScope(currentUser, businessId) !== currentUser.businessId
    )
      throw new ForbiddenException('Manage staff in your own business');
    if (!canManageStaff(currentUser))
      throw new ForbiddenException(
        'Only managers and admins can create staff accounts',
      );
    return this.couriersService.createProfileWithUser(
      body,
      currentUser.businessId,
    );
  }

  @Get()
  @Permissions(Permission.COURIER_PROFILE_READ)
  async getAllCouriersProfiles(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @CurrentUser() actor: UserRequestType,
  ): Promise<Pagination<CourierProfileDto>> {
    return this.couriersService.findAllCouriersProfiles(page, actor.businessId);
  }

  @Get('/:id')
  @Permissions(Permission.COURIER_PROFILE_READ)
  async getCourierProfile(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: UserRequestType,
    @Query('businessId') businessId?: string,
  ): Promise<CourierProfileDto> {
    return this.couriersService.findCourierProfile(
      id,
      resolveBusinessScope(actor, businessId),
    );
  }

  @Put('/:id')
  @Permissions(Permission.COURIER_PROFILE_UPDATE)
  async updateCourierProfile(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCourierProfileDto,
    @CurrentUser() actor: UserRequestType,
    @Query('businessId') businessId?: string,
  ): Promise<CourierProfileDto> {
    if (!canManageStaff(actor))
      throw new ForbiddenException('Only managers and admins can update staff');
    if (resolveBusinessScope(actor, businessId) !== actor.businessId)
      throw new ForbiddenException('Manage staff in your own business');
    return this.couriersService.update(id, body, actor.businessId);
  }

  @Patch('/:id/block')
  @Permissions(Permission.COURIER_PROFILE_BLOCK)
  async toggleBlockCourier(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: UserRequestType,
    @Query('businessId') businessId?: string,
  ): Promise<CourierProfileDto> {
    if (!currentUser.isAdmin && !currentUser.isSuperAdmin)
      throw new ForbiddenException('Only admins can block staff');
    if (
      resolveBusinessScope(currentUser, businessId) !== currentUser.businessId
    )
      throw new ForbiddenException('Manage staff in your own business');
    return this.couriersService.toggleBlock(id, currentUser);
  }

  @Delete(':id')
  @Permissions(Permission.COURIER_PROFILE_DELETE)
  removeCourierProfile(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: UserRequestType,
  ): Promise<void> {
    return this.couriersService.removeCourierProfile(id, actor.businessId);
  }
}
