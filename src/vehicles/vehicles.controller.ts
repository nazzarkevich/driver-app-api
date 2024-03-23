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

@ApiTags('Vehicle')
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  async createVehicle(@Body() body: CreateVehicleDto) {
    return this.vehiclesService.create(body);
  }

  @Get()
  async getAllVehicles() {
    return this.vehiclesService.findAll();
  }

  @Get('/:id')
  async getVehicle(@Param('id', ParseIntPipe) id: number) {
    return this.vehiclesService.findOne(id);
  }
}
