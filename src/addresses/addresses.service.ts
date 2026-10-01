import { BadRequestException, Injectable } from '@nestjs/common';

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
    if (
      countryIsoCode !== 'GB' &&
      (address.provider || address.providerRef || address.uprn)
    ) {
      throw new BadRequestException(
        'Provider address metadata is only supported for GB addresses',
      );
    }
    const country = await this.prismaService.country.findUnique({
      where: { isoCode: countryIsoCode },
    });

    if (!country) {
      throw new Error(`Country with ISO code ${countryIsoCode} not found`);
    }

    await this.prismaService.$transaction(async (prisma) => {
      const activeAddressCount = await prisma.address.count({
        where: { profileId, isActive: true, isDeleted: false },
      });
      const makePrimary = isPrimary === true || activeAddressCount === 0;
      if (makePrimary) {
        await prisma.address.updateMany({
          where: { profileId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      await prisma.address.create({
        data: {
          street: address.street ?? address.line1,
          city: address.city,
          village: address.village,
          postcode: address.postcode,
          region: address.region,
          flat: address.flat,
          building: address.building,
          block: address.block,
          note: address.note,
          line1: address.line1,
          line2: address.line2,
          line3: address.line3,
          county: address.county,
          uprn: address.uprn,
          latitude: address.latitude,
          longitude: address.longitude,
          provider: address.provider,
          providerRef: address.providerRef,
          isPrimary: makePrimary,
          businessId,
          profileId,
          countryId: country.id,
        },
      });
    });
  }

  async findAll(): Promise<AddressDto[]> {
    const allAddresses = await this.prismaService.address.findMany({
      where: { isDeleted: false },
    });

    return allAddresses.map((address) => new AddressDto(address));
  }

  async findAddressesByProfileId(profileId: number): Promise<AddressDto[]> {
    const addresses = await this.prismaService.address.findMany({
      where: {
        profileId,
        isDeleted: false,
      },
    });

    return addresses.map((address) => new AddressDto(address));
  }
}
