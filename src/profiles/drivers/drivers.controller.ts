import {
  Body,
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

@ApiTags('Driver')
@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post()
  @Permissions(Permission.DRIVER_PROFILE_CREATE)
  async createDriverProfile(
    @Body() body: CreateDriverProfileDto,
  ): Promise<void> {
    return this.driversService.createProfile(body);
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
  ): Promise<DriverProfileDto> {
    return this.driversService.createProfileWithUser(
      body,
      currentUser.businessId,
    );
  }

  @Get()
  @Permissions(Permission.DRIVER_PROFILE_READ)
  async getAllDriversProfiles(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ): Promise<Pagination<DriverProfileDto>> {
    return this.driversService.findAll(page);
  }

  @Get('/:id')
  @Permissions(Permission.DRIVER_PROFILE_READ)
  async getDriverProfile(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DriverProfileDto> {
    return this.driversService.findOne(id);
  }

  @Put('/:id')
  @Permissions(Permission.DRIVER_PROFILE_UPDATE)
  async updateDriverProfile(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateDriverProfileDto,
  ): Promise<DriverProfileDto> {
    return this.driversService.update(id, body);
  }

  @Patch('/:id/block')
  @Permissions(Permission.DRIVER_PROFILE_BLOCK)
  async toggleBlockDriver(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: UserRequestType,
  ): Promise<DriverProfileDto> {
    return this.driversService.toggleBlock(id, currentUser);
  }

  @Delete()
  @Permissions(Permission.DRIVER_PROFILE_DELETE)
  removeDriverProfile(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.driversService.remove(id);
  }
}
