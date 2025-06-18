import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AddressesService } from './addresses.service';
import { AddAddressDto } from './dtos/add-address.dto';
import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';

@ApiTags('Address')
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  async createAddress(
    @CurrentUser() currentUser: UserRequestType,
    @Body() body: AddAddressDto,
  ): Promise<void> {
    return this.addressesService.createAddress(body, currentUser.businessId);
  }

  @Get()
  async findAllAddresses() {
    return this.addressesService.findAll();
  }
}
