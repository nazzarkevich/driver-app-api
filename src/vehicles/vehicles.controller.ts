import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { VehicleDto } from './dtos/vehicle.dto';
import { VehiclesService } from './vehicles.service';
import { Pagination } from 'src/dtos/pagination.dto';
import { CreateVehicleDto } from './dtos/create-vehicle.dto';

@ApiTags('Vehicle')
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  async createVehicle(@Body() body: CreateVehicleDto): Promise<void> {
    return this.vehiclesService.create(body);
  }

  @Get()
  async getAllVehicles(
    @Query('page', ParseIntPipe) page: number,
  ): Promise<Pagination<VehicleDto>> {
    return this.vehiclesService.findAll(page);
  }

  @Get('/:id')
  async getVehicle(@Param('id', ParseIntPipe) id: number): Promise<VehicleDto> {
    return this.vehiclesService.findOne(id);
  }
}
