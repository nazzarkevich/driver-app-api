import { AddressLookupContextDto } from './dto/address-lookup-context.dto';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AddressSearchService } from './address-search.service';
import { SearchAddressDto } from './dto/search-address.dto';
import { RetrieveAddressDto } from './dto/retrieve-address.dto';
import { ValidatePostcodeDto } from './dto/validate-postcode.dto';
import { AddressSearchRateLimitGuard } from './address-search-rate-limit.guard';

@ApiTags('Address search')
@Controller()
@UseGuards(AddressSearchRateLimitGuard)
export class AddressSearchController {
  constructor(private readonly addressSearchService: AddressSearchService) {}

  @Get('address-search')
  search(@Query() query: SearchAddressDto) {
    return this.addressSearchService.search(query.query, query);
  }

  @Get('address-search/:id')
  retrieve(@Param() params: RetrieveAddressDto, @Query() query: AddressLookupContextDto) {
    return this.addressSearchService.retrieve(params.id, query);
  }

  @Get('postcodes/:postcode')
  validatePostcode(@Param() params: ValidatePostcodeDto) {
    return this.addressSearchService.validatePostcode(params.postcode);
  }
}
