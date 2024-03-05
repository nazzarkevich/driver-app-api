import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { CustomerProfileDto } from './dtos/customer-profile.dto';
import { BusinessesService } from 'src/businesses/businesses.service';
import { CreateCustomerProfileDto } from './dtos/create-customer-profile.dto';
import { UpdateCustomerProfileDto } from './dtos/update-customer-profile.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly businessesService: BusinessesService,
  ) {}

  async createProfile({ address, ...profile }: CreateCustomerProfileDto) {
    // TODO: add dynamic business ID
    const business = await this.businessesService.findOne(1);

    await this.prismaService.customerProfile.create({
      data: {
        ...profile,
        business: {
          connect: {
            id: business.id,
          },
        },
        address: {
          create: {
            ...address,
          },
        },
      },
    });
  }

  async findAll(): Promise<CustomerProfileDto[]> {
    const allCustomersProfiles =
      await this.prismaService.customerProfile.findMany({
        include: {
          address: true,
        },
      });

    return allCustomersProfiles.map(
      (profile) => new CustomerProfileDto(profile),
    );
  }

  async findProfile(id: number) {
    const profile = await this.prismaService.customerProfile.findUnique({
      where: {
        id,
      },
    });

    if (!profile) {
      throw new NotFoundException();
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

  async removeProfile(id: number) {
    await this.prismaService.customerProfile.delete({
      where: {
        id,
      },
    });
  }
}
