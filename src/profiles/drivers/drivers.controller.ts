import { Body, Controller, Post } from '@nestjs/common';

import { DriversService } from './drivers.service';
import { CreateDriverProfileDto } from './dtos/create-driver-profile.dto';

@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post()
  async createUser(@Body() body: CreateDriverProfileDto) {
    return this.driversService.createProfile(body);
  }
}
