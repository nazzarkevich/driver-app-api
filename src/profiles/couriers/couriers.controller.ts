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

import { AdminGuard } from 'src/guards/admin.guard';
import { BusinessAdminGuard } from 'src/guards/business-admin.guard';
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

// TODO: Question: how to create Audit table to store all the actions

// TODO: create a new table with courier journeys which includes parcels

@ApiTags('Courier')
@Controller('couriers')
export class CouriersController {
  constructor(private readonly couriersService: CouriersService) {}

  @Post()
  async createCourierProfile(
    @Body() body: CreateCourierProfileDto,
  ): Promise<void> {
    return this.couriersService.createProfile(body);
  }

  @Post('create-with-user')
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
  ): Promise<CourierProfileDto> {
    return this.couriersService.createProfileWithUser(
      body,
      currentUser.businessId,
    );
  }

  @Get()
  async getAllCouriersProfiles(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ): Promise<Pagination<CourierProfileDto>> {
    return this.couriersService.findAllCouriersProfiles(page);
  }

  @Get('/:id')
  async getCourierProfile(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CourierProfileDto> {
    return this.couriersService.findCourierProfile(id);
  }

  @Put('/:id')
  async updateCourierProfile(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCourierProfileDto,
  ): Promise<CourierProfileDto> {
    return this.couriersService.update(id, body);
  }

  @Patch('/:id/block')
  @UseGuards(BusinessAdminGuard)
  async toggleBlockCourier(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: UserRequestType,
  ): Promise<CourierProfileDto> {
    return this.couriersService.toggleBlock(id, currentUser);
  }

  @Delete()
  @UseGuards(AdminGuard)
  removeCourierProfile(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.couriersService.removeCourierProfile(id);
  }
}
