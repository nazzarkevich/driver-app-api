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

/*
  - Extend courier service and controller ✅
  - Create Journey module/service/controller ✅
  - Create Country module/service/controller ✅
  - Create Address module/service/controller
  
  - Create CourierJourney module/service/controller
  - Investigate if we need controller for ConnectedParcel
  - Investigate Audit table to store all the actions
  - Roles and Permissions
  - Add error explanation to the DTO files

  Other:
  - Swagger
  - Pagination
  
  - Auth0 (reset pass logic)
  - Email service
  - SMS service -> Viber/Whatsapp
  - QRCode service
*/

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
