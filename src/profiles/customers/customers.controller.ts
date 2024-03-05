import { Body, Controller, Get, Post } from '@nestjs/common';

import { CustomersService } from './customers.service';
import { CreateCustomerProfileDto } from './dtos/create-customer-profile.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async getAllProfiles() {
    try {
      const profiles = await this.customersService.findAll();

      return profiles;
    } catch (error) {
      throw new Error(error);
    }
  }

  @Post()
  async createCustomerProfile(@Body() body: CreateCustomerProfileDto) {
    return this.customersService.createProfile(body);
  }
}
