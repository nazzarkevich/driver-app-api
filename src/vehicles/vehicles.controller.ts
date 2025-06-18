import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dtos/create-vehicle.dto';
import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';

@ApiTags('Vehicle')
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  createVehicle(
    @CurrentUser() currentUser: UserRequestType,
    @Body() body: CreateVehicleDto,
  ) {
    return this.vehiclesService.createVehicle(body, currentUser.businessId);
  }

  @Get()
  findAllVehicles(@CurrentUser() currentUser: UserRequestType) {
    return this.vehiclesService.findAll(currentUser.businessId);
  }

  @Get('/:id')
  findVehicle(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.vehiclesService.findOne(id, currentUser.businessId);
  }
}
