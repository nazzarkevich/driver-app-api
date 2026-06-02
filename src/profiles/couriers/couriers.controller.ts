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

@ApiTags('Courier')
@Controller('couriers')
export class CouriersController {
  constructor(private readonly couriersService: CouriersService) {}

  @Post()
  @Permissions(Permission.COURIER_PROFILE_CREATE)
  async createCourierProfile(
    @Body() body: CreateCourierProfileDto,
  ): Promise<void> {
    return this.couriersService.createProfile(body);
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
  ): Promise<CourierProfileDto> {
    return this.couriersService.createProfileWithUser(
      body,
      currentUser.businessId,
    );
  }

  @Get()
  @Permissions(Permission.COURIER_PROFILE_READ)
  async getAllCouriersProfiles(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ): Promise<Pagination<CourierProfileDto>> {
    return this.couriersService.findAllCouriersProfiles(page);
  }

  @Get('/:id')
  @Permissions(Permission.COURIER_PROFILE_READ)
  async getCourierProfile(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CourierProfileDto> {
    return this.couriersService.findCourierProfile(id);
  }

  @Put('/:id')
  @Permissions(Permission.COURIER_PROFILE_UPDATE)
  async updateCourierProfile(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCourierProfileDto,
  ): Promise<CourierProfileDto> {
    return this.couriersService.update(id, body);
  }

  @Patch('/:id/block')
  @Permissions(Permission.COURIER_PROFILE_BLOCK)
  async toggleBlockCourier(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: UserRequestType,
  ): Promise<CourierProfileDto> {
    return this.couriersService.toggleBlock(id, currentUser);
  }

  @Delete()
  @Permissions(Permission.COURIER_PROFILE_DELETE)
  removeCourierProfile(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.couriersService.removeCourierProfile(id);
  }
}
