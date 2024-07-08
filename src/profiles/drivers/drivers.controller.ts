import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { DriversService } from './drivers.service';
import { AdminGuard } from 'src/guards/admin.guard';
import { Pagination } from 'src/dtos/pagination.dto';
import { DriverProfileDto } from './dtos/driver-profile.dto';
import { CreateDriverProfileDto } from './dtos/create-driver-profile.dto';

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

  @Get()
  async getAllDriversProfiles(
    @Query('page', ParseIntPipe) page: number,
  ): Promise<Pagination<DriverProfileDto>> {
    return this.driversService.findAll(page);
  }

  @Get('/:id')
  async getDriverProfile(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DriverProfileDto> {
    return this.driversService.findOne(id);
  }

  @Delete()
  @UseGuards(AdminGuard)
  removeDriverProfile(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.driversService.remove(id);
  }
}
