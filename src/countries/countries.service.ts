import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { AddCountryDto } from './dtos/add-country.dto';
import { CountryDto } from './dtos/country.dto';
import { Pagination } from 'src/dtos/pagination.dto';
import prismaWithPagination from 'src/prisma/prisma-client';

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

  async findAll(page: number): Promise<Pagination<CountryDto>> {
    const [countriesWithPagination, metadata] =
      await prismaWithPagination.country.paginate().withPages({ page });

    const countries = countriesWithPagination.map(
      (country) => new CountryDto(country),
    );

    return {
      items: countries,
      ...metadata,
    };
  }
}
