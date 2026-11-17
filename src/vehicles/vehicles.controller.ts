import {
  BadRequestException,
  ForbiddenException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';

import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dtos/create-vehicle.dto';
import { UpdateVehicleDto } from './dtos/update-vehicle.dto';
import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';
import { Permissions } from 'src/decorators/permissions.decorator';
import { Permission } from 'src/permissions/permissions';
import { resolveBusinessScope } from 'src/common/business-scope';

@ApiTags('Vehicle')
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @Permissions(Permission.VEHICLE_CREATE)
  createVehicle(
    @CurrentUser() currentUser: UserRequestType,
    @Body() body: CreateVehicleDto,
  ) {
    return this.vehiclesService.createVehicle(body, currentUser.businessId);
  }

  @Get()
  @ApiQuery({
    name: 'businessId',
    required: false,
    type: Number,
    description: 'Business scope override for superadmins',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Positive page number; omit for legacy array response',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by registration number, make or model',
  })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @Permissions(Permission.VEHICLE_READ)
  findAllVehicles(
    @CurrentUser() currentUser: UserRequestType,
    @Query('businessId') businessId?: string,
    @Query('page') page?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    const scopedBusinessId = resolveBusinessScope(currentUser, businessId);
    if (
      page !== undefined &&
      (!/^[1-9]\d*$/.test(page) || !Number.isSafeInteger(Number(page)))
    ) {
      throw new BadRequestException('Invalid page');
    }
    if (isActive !== undefined && isActive !== 'true' && isActive !== 'false') {
      throw new BadRequestException('Invalid active status');
    }
    return this.vehiclesService.findAll(
      scopedBusinessId,
      {
        page: page === undefined ? undefined : Number(page),
        search: search?.trim() || undefined,
        isActive: isActive === undefined ? undefined : isActive === 'true',
      },
      currentUser,
    );
  }

  @Get('/:id')
  @ApiQuery({
    name: 'businessId',
    required: false,
    type: Number,
    description: 'Business scope override for superadmins',
  })
  @Permissions(Permission.VEHICLE_READ)
  findVehicle(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Query('businessId') businessId?: string,
  ) {
    return this.vehiclesService.findOne(
      id,
      resolveBusinessScope(currentUser, businessId),
      currentUser,
    );
  }

  @Put('/:id')
  @Permissions(Permission.VEHICLE_UPDATE)
  updateVehicle(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateVehicleDto,
    @Query('businessId') businessId?: string,
  ) {
    const scopedBusinessId = resolveBusinessScope(currentUser, businessId);
    if (scopedBusinessId !== currentUser.businessId) {
      throw new ForbiddenException(
        'Vehicles can only be updated in your own business',
      );
    }
    return this.vehiclesService.updateVehicle(id, body, scopedBusinessId);
  }
}
