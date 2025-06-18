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

import { CustomersService } from './customers.service';
import { CreateCustomerProfileDto } from './dtos/create-customer-profile.dto';
import { UpdateCustomerProfileDto } from './dtos/update-customer-profile.dto';
import { AdminGuard } from 'src/guards/admin.guard';
import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';

@ApiTags('Customer Profile')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  async createProfile(
    @CurrentUser() currentUser: UserRequestType,
    @Body() body: CreateCustomerProfileDto,
  ) {
    return this.customersService.createProfile(body, currentUser.businessId);
  }

  @Get()
  async findAllCustomers(@CurrentUser() currentUser: UserRequestType) {
    const profiles = await this.customersService.findAll(
      currentUser.businessId,
    );
    return profiles;
  }

  @Get('/:id')
  async findCustomer(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const profiles = await this.customersService.findOne(
      id,
      currentUser.businessId,
    );

    return profiles;
  }

  @Put('/:id')
  updateCustomer(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCustomerProfileDto,
  ) {
    // TODO: Add permission
    // 1) user can edit their details
    // 2) Admin can edit all users details

    return this.customersService.update(id, body, currentUser.businessId);
  }

  @Delete('/:id')
  @UseGuards(AdminGuard)
  removeCustomer(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.customersService.remove(id, currentUser.businessId);
  }
}
