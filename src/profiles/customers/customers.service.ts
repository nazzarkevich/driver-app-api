import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { CustomerProfileDto } from './dtos/customer-profile.dto';
import { BusinessesService } from 'src/businesses/businesses.service';
import { CreateCustomerProfileDto } from './dtos/create-customer-profile.dto';
import { UpdateCustomerProfileDto } from './dtos/update-customer-profile.dto';
import { Pagination } from 'src/dtos/pagination.dto';
import prismaWithPagination from 'src/prisma/prisma-client';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly businessesService: BusinessesService,
  ) {}

  async createProfile({
    address,
    phoneNumber,
    ...profile
  }: CreateCustomerProfileDto): Promise<void> {
    // TODO: Question: add transaction for creating profile + address?
    // TODO: Question: do we need yto break down into two steps?
    const businessId = 1; // TODO: add dynamic business ID
    const business = await this.businessesService.findOne(businessId);

    await this.prismaService.customerProfile.create({
      data: {
        ...profile,
        business: {
          connect: {
            id: business.id,
          },
        },
        phoneNumber: {
          create: {
            ...phoneNumber,
          },
        },
        primaryAddress: {
          create: {
            ...address,
            country: {
              connect: {
                isoCode: address.countryIsoCode,
              },
            },
          },
        },
      },
    });
  }

  async findAll(page: number): Promise<Pagination<CustomerProfileDto>> {
    const [customerProfilesWithPagination, metadata] =
      await prismaWithPagination.customerProfile
        .paginate({
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            primaryAddress: true,
          },
        })
        .withPages({ page });

    const customerProfiles = customerProfilesWithPagination.map(
      (profile) => new CustomerProfileDto(profile),
    );

    return {
      items: customerProfiles,
      ...metadata,
    };
  }

  async findProfile(id: number): Promise<CustomerProfileDto> {
    const profile = await this.prismaService.customerProfile.findUnique({
      where: {
        id,
      },
    });

    if (!profile) {
      throw new NotFoundException('Customer profile not found');
    }

    return new CustomerProfileDto(profile);
  }

  async updateProfile(
    id: number,
    attrs: Partial<UpdateCustomerProfileDto>,
  ): Promise<CustomerProfileDto> {
    const profile = await this.findProfile(id);

    if (!profile) {
      throw new Error('Customer Profile not found');
    }

    Object.assign(profile, attrs);

    const updatedProfile = await this.prismaService.customerProfile.update({
      where: {
        id,
      },
      data: attrs,
    });

    return new CustomerProfileDto(updatedProfile);
  }

  async removeProfile(id: number): Promise<void> {
    await this.prismaService.customerProfile.delete({
      where: {
        id,
      },
    });
  }
}
