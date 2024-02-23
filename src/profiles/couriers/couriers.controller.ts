import { Body, Controller, Post } from '@nestjs/common';

import { CouriersService } from './couriers.service';
import { CreateCourierProfileDto } from './dtos/create-courier-profile.dto';

@Controller('couriers')
export class CouriersController {
  constructor(private readonly couriersService: CouriersService) {}

  @Post()
  async createUser(@Body() body: CreateCourierProfileDto) {
    return this.couriersService.createProfile(body);
  }
}
