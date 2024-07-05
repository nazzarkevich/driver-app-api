import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CountriesService } from './countries.service';
import { AddCountryDto } from './dtos/add-country.dto';

@ApiTags('Country')
@Controller('countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Post()
  async addCountry(@Body() body: AddCountryDto) {
    return this.countriesService.addCountry(body);
  }

  @Get()
  async getAllCountries(@Query('page', ParseIntPipe) page: number) {
    return this.countriesService.findAll(page);
  }
}
