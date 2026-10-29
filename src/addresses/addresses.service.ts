import {
  validateAddressMetadata,
  validateUkraineAddress,
} from 'src/address-search/utils/address-metadata';
import { Injectable, NotFoundException } from '@nestjs/common';

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
    validateAddressMetadata(countryIsoCode, address);
    validateUkraineAddress({ ...address, countryIsoCode });
    const country = await this.prismaService.country.findUnique({
      where: { isoCode: countryIsoCode },
    });

    if (!country) {
      throw new Error(`Country with ISO code ${countryIsoCode} not found`);
    }

    await this.prismaService.$transaction(async (prisma) => {
      if (
        profileId != null &&
        !(await prisma.customerProfile.findFirst({
          where: { id: profileId, businessId, isDeleted: false },
          select: { id: true },
        }))
      ) {
        throw new NotFoundException('Customer profile not found');
      }
      const activeAddressCount =
        profileId != null
          ? await prisma.address.count({
              where: {
                profileId,
                businessId,
                isActive: true,
                isDeleted: false,
              },
            })
          : 0;
      const makePrimary =
        profileId != null && (isPrimary === true || activeAddressCount === 0);
      if (makePrimary) {
        await prisma.address.updateMany({
          where: { profileId, businessId, isPrimary: true },
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

  async findAll(businessId: number): Promise<AddressDto[]> {
    const allAddresses = await this.prismaService.address.findMany({
      where: { businessId, isDeleted: false },
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
