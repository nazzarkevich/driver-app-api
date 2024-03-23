import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AddAddressDto } from './dtos/add-address.dto';
import { AddressesService } from './addresses.service';

@ApiTags('Address')
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  async addAddress(@Body() body: AddAddressDto) {
    return this.addressesService.addAddress(body);
  }

  @Get()
  async getAddressByProfileId(@Query('profileId') profileId: number) {
    return this.addressesService.findAddressesByProfileId(profileId);
  }
}
