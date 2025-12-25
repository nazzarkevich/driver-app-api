import { Injectable, NotFoundException } from '@nestjs/common';

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
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                isBlocked: true,
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
          primaryAddress: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              isBlocked: true,
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
      throw new NotFoundException(
        'You can only delete notes that you created',
      );
    }

    await this.prismaService.customerNote.delete({
      where: { id: noteId },
    });
  }
}
