import { Body, Controller, Get, Post } from '@nestjs/common';

import { CountriesService } from './countries.service';
import { AddCountryDto } from './dtos/add-country.dto';

@Controller('countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Post()
  async addCountry(@Body() body: AddCountryDto) {
    return this.countriesService.addCountry(body);
  }

  @Get()
  async getAllCountries() {
    return this.countriesService.findAll();
  }
}
