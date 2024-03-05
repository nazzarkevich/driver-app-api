import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { CustomerProfileDto } from './dtos/customer-profile.dto';
import { BusinessesService } from 'src/businesses/businesses.service';
import { CreateCustomerProfileDto } from './dtos/create-customer-profile.dto';

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
}
