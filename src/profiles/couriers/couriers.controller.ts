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
  - Create CourierJourney module/service/controller ✅
  - Add UA and UK address tables ✅
  - Extend Parcel schema with addresses UA and UK ✅
  - Create Address module/service/controller 


  - Add default sorting for lists (https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting)
  - Investigate if we need controller for ConnectedParcel
  - Investigate Audit table to store all the actions
  - Roles and Permissions
  - Add error explanation to the DTO files
  - Add seed script for Prisma

  Other:
  - Swagger
  - Pagination (https://nodeteam.medium.com/nest-js-prisma-pagination-b776592f1867)
  
  - Auth0 (reset pass logic)
  - Email service
  - SMS service (https://nodeteam.medium.com/nest-js-providers-twilio-e277ed924465)
  - Viber/Whatsapp
  - QRCode service

  Docs:
    Repository pattern:
     - https://github.com/prisma/prisma/issues/5273
     - https://github.com/johannesschobel/nest-prisma-crud

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
