import { Injectable } from '@nestjs/common';

import { AddressDto } from './dtos/address.dto';
import { AddAddressDto } from './dtos/add-address.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AddressesService {
  constructor(private readonly prismaService: PrismaService) {}

  async addAddress({
    profileId,
    countryIsoCode,
    ...address
  }: AddAddressDto): Promise<void> {
    const country = await this.prismaService.country.findUnique({
      where: { isoCode: countryIsoCode },
    });

    await this.prismaService.address.create({
      data: {
        ...address,
        profile: {
          connect: {
            id: profileId,
          },
        },
        country: {
          connect: {
            id: country.id,
          },
        },
      },
    });
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
