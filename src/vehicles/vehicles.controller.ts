import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dtos/create-vehicle.dto';
import { UpdateVehicleDto } from './dtos/update-vehicle.dto';
import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';
import { Permissions } from 'src/decorators/permissions.decorator';
import { Permission } from 'src/permissions/permissions';

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
  @Permissions(Permission.VEHICLE_READ)
  findAllVehicles(@CurrentUser() currentUser: UserRequestType) {
    return this.vehiclesService.findAll(currentUser.businessId);
  }

  @Get('/:id')
  @Permissions(Permission.VEHICLE_READ)
  findVehicle(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.vehiclesService.findOne(id, currentUser.businessId);
  }

  @Put('/:id')
  @Permissions(Permission.VEHICLE_UPDATE)
  updateVehicle(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateVehicleDto,
  ) {
    return this.vehiclesService.updateVehicle(id, body, currentUser.businessId);
  }
}
