import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCustomerProfileDto } from './dtos/create-customer-profile.dto';
import { CustomerProfileDto } from './dtos/customer-profile.dto';
import { UpdateCustomerProfileDto } from './dtos/update-customer-profile.dto';
import { CustomerNoteDto } from './dtos/customer-note.dto';
import { BaseTenantService } from 'src/common/base-tenant.service';
import { Pagination } from 'src/dtos/pagination.dto';
import prismaWithPagination from 'src/prisma/prisma-client';

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
      address,
    }: CreateCustomerProfileDto,
    businessId: number,
  ): Promise<void> {
    await this.validateBusinessAccess(businessId);

    const country = await this.prismaService.country.findUnique({
      where: { isoCode: address.countryIsoCode },
    });

    if (!country) {
      throw new NotFoundException(
        `Country with ISO code ${address.countryIsoCode} not found`,
      );
    }

    await this.prismaService.$transaction(async (prisma) => {
      const phone = await prisma.phone.create({
        data: {
          number: phoneNumber.number,
          countryCode: phoneNumber.countryCode,
        },
      });

      const customerProfile = await prisma.customerProfile.create({
        data: {
          firstName,
          lastName,
          gender,
          businessId,
          phoneId: phone.id,
        },
      });

      await prisma.address.create({
        data: {
          street: address.street,
          city: address.city,
          village: address.village,
          postcode: address.postcode,
          region: address.region,
          flat: address.flat,
          businessId,
          profileId: customerProfile.id,
          countryId: country.id,
        },
      });
    });
  }

  async findAll(
    businessId: number,
    page?: number,
    search?: string,
    isBlocked?: boolean,
    originCountryId?: number,
    isActive?: boolean,
  ): Promise<Pagination<CustomerProfileDto> | CustomerProfileDto[]> {
    await this.validateBusinessAccess(businessId);

    const baseWhere = this.getBusinessFilter(businessId);
    const conditions: any[] = [];

    // Search filter: firstName, lastName, or phone number
    if (search) {
      conditions.push({
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          {
            phoneNumber: {
              number: { contains: search, mode: 'insensitive' },
            },
          },
        ],
      });
    }

    if (originCountryId) {
      conditions.push({
        primaryAddress: {
          countryId: originCountryId,
        },
      });
    }

    // Blocked status filter
    if (isBlocked !== undefined) {
      conditions.push({ user: { isBlocked } });
    }

    // Active status filter
    if (isActive !== undefined) {
      conditions.push({ isActive });
    }

    const whereClause =
      conditions.length > 0
        ? {
            ...baseWhere,
            AND: conditions,
          }
        : baseWhere;

    if (page) {
      // Return paginated results
      const [customersWithPagination, metadata] =
        await prismaWithPagination.customerProfile
          .paginate({
            orderBy: {
              createdAt: 'desc',
            },
            where: whereClause,
            include: {
              phoneNumber: true,
              primaryAddress: {
                include: {
                  country: true,
                },
              },
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  isBlocked: true,
                },
              },
              notes: {
                include: {
                  user: true,
                },
                orderBy: {
                  createdAt: 'desc',
                },
              },
            },
          })
          .withPages({ page });

      const customers = customersWithPagination.map(
        (profile) => new CustomerProfileDto(profile),
      );

      return {
        items: customers,
        ...metadata,
      };
    } else {
      // Return all results (no pagination)
      const customerProfiles =
        await this.prismaService.customerProfile.findMany({
          where: whereClause,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            phoneNumber: true,
            primaryAddress: {
              include: {
                country: true,
              },
            },
            notes: {
              include: {
                user: true,
              },
              orderBy: {
                createdAt: 'desc',
              },
            },
          },
        });

      return customerProfiles.map((profile) => new CustomerProfileDto(profile));
    }
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
          primaryAddress: {
            include: {
              country: true,
            },
          },
          notes: {
            include: {
              user: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
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
      throw new NotFoundException('Customer profile not found');
    }

    const existingProfile = await this.prismaService.customerProfile.findUnique(
      {
        where: { id },
        select: { phoneId: true },
      },
    );

    await this.prismaService.$transaction(async (prisma) => {
      if (attrs.phoneNumber && existingProfile?.phoneId) {
        const phoneUpdateData: Prisma.PhoneUpdateInput = {};
        if (attrs.phoneNumber.number !== undefined) {
          phoneUpdateData.number = attrs.phoneNumber.number;
        }
        if (attrs.phoneNumber.countryCode !== undefined) {
          phoneUpdateData.countryCode = attrs.phoneNumber.countryCode;
        }
        if (Object.keys(phoneUpdateData).length > 0) {
          await prisma.phone.update({
            where: { id: existingProfile.phoneId },
            data: phoneUpdateData,
          });
        }
      }

      if (attrs.address) {
        const addressUpdateData: Prisma.AddressUpdateInput = {};

        if (attrs.address.countryIsoCode) {
          const country = await prisma.country.findUnique({
            where: { isoCode: attrs.address.countryIsoCode },
          });
          if (!country) {
            throw new NotFoundException(
              `Country with ISO code ${attrs.address.countryIsoCode} not found`,
            );
          }
          addressUpdateData.country = { connect: { id: country.id } };
        }

        if (attrs.address.street !== undefined) {
          addressUpdateData.street = attrs.address.street;
        }
        if (attrs.address.city !== undefined) {
          addressUpdateData.city = attrs.address.city;
        }
        if (attrs.address.region !== undefined) {
          addressUpdateData.region = attrs.address.region;
        }
        if (attrs.address.postcode !== undefined) {
          addressUpdateData.postcode = attrs.address.postcode;
        }
        if (attrs.address.building !== undefined) {
          addressUpdateData.building = attrs.address.building;
        }
        if (attrs.address.flat !== undefined) {
          addressUpdateData.flat = attrs.address.flat;
        }
        if (attrs.address.village !== undefined) {
          addressUpdateData.village = attrs.address.village;
        }

        if (Object.keys(addressUpdateData).length > 0) {
          await prisma.address.update({
            where: { profileId: id },
            data: addressUpdateData,
          });
        }
      }

      const profileData: Prisma.CustomerProfileUpdateInput = {};
      if (attrs.firstName !== undefined)
        profileData.firstName = attrs.firstName;
      if (attrs.lastName !== undefined) profileData.lastName = attrs.lastName;
      if (attrs.gender !== undefined) profileData.gender = attrs.gender;
      if (attrs.isActive !== undefined) profileData.isActive = attrs.isActive;

      if (Object.keys(profileData).length > 0) {
        await prisma.customerProfile.update({
          where: { id },
          data: profileData,
        });
      }
    });

    return this.findOne(id, businessId);
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

  async addNote(
    customerProfileId: number,
    content: string,
    userId: number,
    businessId: number,
  ): Promise<CustomerNoteDto> {
    await this.validateBusinessAccess(businessId);

    const profile = await this.prismaService.customerProfile.findUnique({
      where: { id: customerProfileId },
      select: { businessId: true },
    });

    if (!profile || profile.businessId !== businessId) {
      throw new NotFoundException('Customer profile not found');
    }

    const note = await this.prismaService.customerNote.create({
      data: {
        content,
        customerProfileId,
        userId,
      },
      include: {
        user: true,
      },
    });

    return new CustomerNoteDto(note);
  }

  async getNotes(
    customerProfileId: number,
    businessId: number,
  ): Promise<CustomerNoteDto[]> {
    await this.validateBusinessAccess(businessId);

    const profile = await this.prismaService.customerProfile.findUnique({
      where: { id: customerProfileId },
      select: { businessId: true },
    });

    if (!profile || profile.businessId !== businessId) {
      throw new NotFoundException('Customer profile not found');
    }

    const notes = await this.prismaService.customerNote.findMany({
      where: { customerProfileId },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return notes.map((note) => new CustomerNoteDto(note));
  }

  async deleteNote(
    noteId: number,
    userId: number,
    businessId: number,
  ): Promise<void> {
    await this.validateBusinessAccess(businessId);

    const note = await this.prismaService.customerNote.findUnique({
      where: { id: noteId },
      include: {
        customerProfile: {
          select: { businessId: true },
        },
      },
    });

    if (!note || note.customerProfile.businessId !== businessId) {
      throw new NotFoundException('Note not found');
    }

    if (note.userId !== userId) {
      throw new NotFoundException('You can only delete notes that you created');
    }

    await this.prismaService.customerNote.delete({
      where: { id: noteId },
    });
  }
}
