import { Injectable } from '@nestjs/common';

import { AddressDto } from './dtos/address.dto';
import { AddAddressDto } from './dtos/add-address.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AddressesService {
  constructor(private readonly prismaService: PrismaService) {}

  async createAddress(
    { profileId, countryIsoCode, isPrimary, ...address }: AddAddressDto,
    businessId: number,
  ): Promise<void> {
    const country = await this.prismaService.country.findUnique({
      where: { isoCode: countryIsoCode },
    });

    if (!country) {
      throw new Error(`Country with ISO code ${countryIsoCode} not found`);
    }

    await this.prismaService.address.create({
      data: {
        ...address,
        isPrimary: isPrimary ?? false,
        businessId,
        profileId,
        countryId: country.id,
      },
    });
  }

  async findAll(): Promise<AddressDto[]> {
    const allAddresses = await this.prismaService.address.findMany({});

    return allAddresses.map((address) => new AddressDto(address));
  }

  async findAddressesByProfileId(profileId: number): Promise<AddressDto[]> {
    const addresses = await this.prismaService.address.findMany({
      where: {
        profileId,
      },
    });

    return addresses.map((address) => new AddressDto(address));
  }
}
