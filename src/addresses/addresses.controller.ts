import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AddressesService } from './addresses.service';
import { AddAddressDto } from './dtos/add-address.dto';
import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';
import { Permissions } from 'src/decorators/permissions.decorator';
import { Permission } from 'src/permissions/permissions';

@ApiTags('Address')
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  @Permissions(Permission.CUSTOMER_ADDRESS_CREATE)
  async createAddress(
    @CurrentUser() currentUser: UserRequestType,
    @Body() body: AddAddressDto,
  ): Promise<void> {
    return this.addressesService.createAddress(body, currentUser.businessId);
  }

  @Get()
  @Permissions(Permission.CUSTOMER_READ)
  async findAllAddresses(@CurrentUser() currentUser: UserRequestType) {
    return this.addressesService.findAll(currentUser.businessId);
  }
}
