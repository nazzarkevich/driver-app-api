import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AdminGuard } from 'src/guards/admin.guard';
import { Pagination } from 'src/dtos/pagination.dto';
import { CustomersService } from './customers.service';
import { CustomerProfileDto } from './dtos/customer-profile.dto';
import { CreateCustomerProfileDto } from './dtos/create-customer-profile.dto';
import { UpdateCustomerProfileDto } from './dtos/update-customer-profile.dto';

@ApiTags('Customer')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  async createCustomerProfile(
    @Body() body: CreateCustomerProfileDto,
  ): Promise<void> {
    return this.customersService.createProfile(body);
  }

  @Get()
  async findProfiles(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ): Promise<Pagination<CustomerProfileDto>> {
    const profiles = await this.customersService.findAll(page);

    return profiles;
  }

  @Get('/:id')
  async findProfile(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CustomerProfileDto> {
    const profiles = await this.customersService.findProfile(id);

    return profiles;
  }

  @Put('/:id')
  updateProfile(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCustomerProfileDto,
  ): Promise<CustomerProfileDto> {
    // TODO: Add permission
    // 1) user can edit their details
    // 2) Admin can edit all users details

    return this.customersService.updateProfile(id, body);
  }

  @Delete('/:id')
  @UseGuards(AdminGuard)
  removeProfile(@Param('id', ParseIntPipe) id: number): Promise<void> {
    // TODO: remove address first
    return this.customersService.removeProfile(id);
  }
}
