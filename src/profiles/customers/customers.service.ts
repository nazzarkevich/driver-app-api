import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCustomerProfileDto } from './dtos/create-customer-profile.dto';
import { CustomerProfileDto } from './dtos/customer-profile.dto';
import { UpdateCustomerProfileDto } from './dtos/update-customer-profile.dto';
import { BaseTenantService } from 'src/common/base-tenant.service';

@Injectable()
export class CustomersService extends BaseTenantService {
  constructor(prismaService: PrismaService) {
    super(prismaService);
  }

  async createProfile(
    {
      firstName,
      lastName,
      gender,
      phoneNumber,
      note,
      address,
    }: CreateCustomerProfileDto,
    businessId: number,
  ): Promise<void> {
    await this.validateBusinessAccess(businessId);

    // Create phone first if provided
    let phoneId: number | undefined;
    if (phoneNumber) {
      const phone = await this.prismaService.phone.create({
        data: {
          number: phoneNumber.number,
          countryCode: phoneNumber.countryCode,
        },
      });
      phoneId = phone.id;
    }

    // Create customer profile with unchecked approach
    const customerProfile = await this.prismaService.customerProfile.create({
      data: {
        firstName,
        lastName,
        gender,
        note,
        businessId,
        phoneId,
      },
    });

    // Create address separately with business context
    if (address) {
      const country = await this.prismaService.country.findUnique({
        where: { isoCode: address.countryIsoCode },
      });

      if (!country) {
        throw new Error(
          `Country with ISO code ${address.countryIsoCode} not found`,
        );
      }

      await this.prismaService.address.create({
        data: {
          ...address,
          businessId,
          profileId: customerProfile.id,
          countryId: country.id,
        },
      });
    }
  }

  async findAll(businessId: number): Promise<CustomerProfileDto[]> {
    await this.validateBusinessAccess(businessId);

    const customerProfiles = await this.prismaService.customerProfile.findMany({
      where: this.getBusinessFilter(businessId),
      include: {
        phoneNumber: true,
        primaryAddress: true,
      },
    });

    return customerProfiles.map((profile) => new CustomerProfileDto(profile));
  }

  async findOne(id: number, businessId: number): Promise<CustomerProfileDto> {
    await this.validateBusinessAccess(businessId);

    const customerProfile = await this.prismaService.customerProfile.findUnique(
      {
        where: {
          id,
        },
        include: {
          phoneNumber: true,
          primaryAddress: true,
        },
      },
    );

    if (!customerProfile || customerProfile.businessId !== businessId) {
      throw new NotFoundException();
    }

    return new CustomerProfileDto(customerProfile);
  }

  async update(
    id: number,
    attrs: Partial<UpdateCustomerProfileDto>,
    businessId: number,
  ): Promise<CustomerProfileDto> {
    const profile = await this.findOne(id, businessId);

    if (!profile) {
      throw new Error('Customer profile not found');
    }

    Object.assign(profile, attrs);

    const updatedProfile = await this.prismaService.customerProfile.update({
      where: {
        id,
      },
      data: attrs,
      include: {
        phoneNumber: true,
        primaryAddress: true,
      },
    });

    return new CustomerProfileDto(updatedProfile);
  }

  async remove(id: number, businessId: number): Promise<void> {
    await this.validateBusinessAccess(businessId);

    // First check if customer profile belongs to the business
    const profile = await this.prismaService.customerProfile.findUnique({
      where: { id },
      select: { businessId: true },
    });

    if (!profile || profile.businessId !== businessId) {
      throw new NotFoundException('Customer profile not found');
    }

    await this.prismaService.customerProfile.delete({
      where: {
        id,
      },
    });
  }
}
