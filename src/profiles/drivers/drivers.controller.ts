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
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';

import { DriversService } from './drivers.service';
import { AdminGuard } from 'src/guards/admin.guard';
import { BusinessAdminGuard } from 'src/guards/business-admin.guard';
import { Pagination } from 'src/dtos/pagination.dto';
import { DriverProfileDto } from './dtos/driver-profile.dto';
import { CreateDriverProfileDto } from './dtos/create-driver-profile.dto';
import { CreateDriverWithUserDto } from './dtos/create-driver-with-user.dto';
import { UpdateDriverProfileDto } from './dtos/update-driver-profile.dto';
import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';

@ApiTags('Driver')
@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post()
  async createDriverProfile(
    @Body() body: CreateDriverProfileDto,
  ): Promise<void> {
    return this.driversService.createProfile(body);
  }

  @Post('create-with-user')
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
  async getAllDriversProfiles(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ): Promise<Pagination<DriverProfileDto>> {
    return this.driversService.findAll(page);
  }

  @Get('/:id')
  async getDriverProfile(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DriverProfileDto> {
    return this.driversService.findOne(id);
  }

  @Put('/:id')
  async updateDriverProfile(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateDriverProfileDto,
  ): Promise<DriverProfileDto> {
    return this.driversService.update(id, body);
  }

  @Patch('/:id/block')
  @UseGuards(BusinessAdminGuard)
  async toggleBlockDriver(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: UserRequestType,
  ): Promise<DriverProfileDto> {
    return this.driversService.toggleBlock(id, currentUser);
  }

  @Delete()
  @UseGuards(AdminGuard)
  removeDriverProfile(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.driversService.remove(id);
  }
}
