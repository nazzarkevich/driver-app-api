import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { DriversService } from './drivers.service';
import { AdminGuard } from 'src/guards/admin.guard';
import { CreateDriverProfileDto } from './dtos/create-driver-profile.dto';

@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post()
  async createDriverProfile(@Body() body: CreateDriverProfileDto) {
    return this.driversService.createProfile(body);
  }

  @Get()
  async getAllDriversProfiles() {
    return this.driversService.findAll();
  }

  @Get('/:id')
  async getDriverProfile(@Param('id', ParseIntPipe) id: number) {
    return this.driversService.findOne(id);
  }

  @Delete()
  @UseGuards(AdminGuard)
  removeDriverProfile(@Param('id', ParseIntPipe) id: number): any {
    return this.driversService.remove(id);
  }
}
