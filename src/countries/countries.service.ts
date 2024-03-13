import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { AddCountryDto } from './dtos/add-country.dto';
import { CountryDto } from './dtos/country.dto';

// TODO: Question: how to initially store countries? seed?

@Injectable()
export class CountriesService {
  constructor(private readonly prismaService: PrismaService) {}

  async addCountry({ name, isoCode }: AddCountryDto) {
    await this.prismaService.country.create({
      data: {
        name,
        isoCode,
      },
    });
  }

  async findAll() {
    const countries = await this.prismaService.country.findMany({});

    return countries.map((country) => new CountryDto(country));
  }
}
