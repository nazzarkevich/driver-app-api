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
import { ApiTags } from '@nestjs/swagger';

import { AdminGuard } from 'src/guards/admin.guard';
import { CouriersService } from './couriers.service';
import { CreateCourierProfileDto } from './dtos/create-courier-profile.dto';

// TODO: Question: how to create Audit table to store all the actions

// TODO: create a new table with courier journeys which includes parcels

@ApiTags('Courier')
@Controller('couriers')
export class CouriersController {
  constructor(private readonly couriersService: CouriersService) {}

  @Post()
  async createCourierProfile(@Body() body: CreateCourierProfileDto) {
    return this.couriersService.createProfile(body);
  }

  @Get()
  async getAllCouriersProfiles() {
    return this.couriersService.findAllCouriersProfiles();
  }

  @Get('/:id')
  async getCourierProfile(@Param('id', ParseIntPipe) id: number) {
    return this.couriersService.findCourierProfile(id);
  }

  @Delete()
  @UseGuards(AdminGuard)
  removeCourierProfile(@Param('id', ParseIntPipe) id: number): any {
    return this.couriersService.removeCourierProfile(id);
  }
}
