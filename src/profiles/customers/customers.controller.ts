import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AdminGuard } from 'src/guards/admin.guard';
import { CustomersService } from './customers.service';
import { CreateCustomerProfileDto } from './dtos/create-customer-profile.dto';
import { UpdateCustomerProfileDto } from './dtos/update-customer-profile.dto';

@ApiTags('Customer')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  async createCustomerProfile(@Body() body: CreateCustomerProfileDto) {
    return this.customersService.createProfile(body);
  }

  @Get()
  async findProfiles() {
    try {
      const profiles = await this.customersService.findAll();

      return profiles;
    } catch (error) {
      throw new Error(error);
    }
  }

  @Get('/:id')
  async findProfile(@Param('id', ParseIntPipe) id: number) {
    try {
      const profiles = await this.customersService.findProfile(id);

      return profiles;
    } catch (error) {
      throw new Error(error);
    }
  }

  @Put('/:id')
  updateProfile(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCustomerProfileDto,
  ) {
    // TODO: Add permission
    // 1) user can edit their details
    // 2) Admin can edit all users details

    return this.customersService.updateProfile(id, body);
  }

  @Delete('/:id')
  @UseGuards(AdminGuard)
  removeProfile(@Param('id', ParseIntPipe) id: number) {
    // TODO: remove address first
    return this.customersService.removeProfile(id);
  }
}
