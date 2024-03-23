import { Injectable } from '@nestjs/common';

import { AddressDto } from './dtos/address.dto';
import { AddAddressDto } from './dtos/add-address.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AddressesService {
  constructor(private readonly prismaService: PrismaService) {}

  async addAddress({ profileId, ...address }: AddAddressDto): Promise<void> {
    await this.prismaService.address.create({
      data: {
        ...address,
        profile: {
          connect: {
            id: profileId,
          },
        },
      },
    });
  }

  async findAddressesByProfileId(profileId: number): Promise<AddressDto[]> {
    const address = await this.prismaService.address.findMany({
      where: {
        profileId,
      },
    });

    return address.map((address) => new AddressDto(address));
  }
}
