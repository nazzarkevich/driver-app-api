import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';

import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCustomerProfileDto } from './dtos/create-customer-profile.dto';
import { CustomerProfileDto } from './dtos/customer-profile.dto';
import { UpdateCustomerProfileDto } from './dtos/update-customer-profile.dto';
import { CustomerNoteDto } from './dtos/customer-note.dto';
import { AuditService } from 'src/audit/audit.service';
import { UserRequestType } from 'src/users/decorators/current-user.decorator';
import { BaseTenantService } from 'src/common/base-tenant.service';
import { Pagination } from 'src/dtos/pagination.dto';
import prismaWithPagination from 'src/prisma/prisma-client';
import { AddAddressDto } from 'src/addresses/dtos/add-address.dto';
import { UpdateAddressDto } from 'src/addresses/dtos/update-address.dto';

const addressInclude = {
  addresses: {
    include: { country: true },
    orderBy: [{ isPrimary: 'desc' as const }, { id: 'asc' as const }],
  },
};

@Injectable()
export class CustomersService extends BaseTenantService {
  constructor(
    prismaService: PrismaService,
    private readonly auditService: AuditService,
  ) {
    super(prismaService);
  }

  async createProfile(
    {
      firstName,
      lastName,
      gender,
      phoneNumber,
      addresses,
    }: CreateCustomerProfileDto,
    businessId: number,
  ): Promise<CustomerProfileDto> {
    await this.validateBusinessAccess(businessId);

    const isoCodes = [...new Set(addresses.map((a) => a.countryIsoCode))];
    const countries = await this.prismaService.country.findMany({
      where: { isoCode: { in: isoCodes } },
    });

    if (countries.length !== isoCodes.length) {
      const missing = isoCodes.filter(
        (c) => !countries.find((co) => co.isoCode === c),
      );
      throw new NotFoundException(`Country not found: ${missing.join(', ')}`);
    }

    const countryMap = Object.fromEntries(countries.map((c) => [c.isoCode, c.id]));

    const createdId = await this.prismaService.$transaction(async (prisma) => {
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

      await prisma.address.createMany({
        data: addresses.map((addr, i) => ({
          street: addr.street,
          city: addr.city,
          village: addr.village,
          postcode: addr.postcode,
          region: addr.region,
          flat: addr.flat,
          isPrimary: i === 0,
          businessId,
          profileId: customerProfile.id,
          countryId: countryMap[addr.countryIsoCode],
        })),
      });

      return customerProfile.id;
    });

    return this.findOne(createdId, businessId);
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
        addresses: { some: { isPrimary: true, countryId: originCountryId } },
      });
    }

    if (isBlocked !== undefined) {
      conditions.push({ user: { isBlocked } });
    }

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
      const [customersWithPagination, metadata] =
        await prismaWithPagination.customerProfile
          .paginate({
            orderBy: {
              createdAt: 'desc',
            },
            where: whereClause,
            include: {
              phoneNumber: true,
              ...addressInclude,
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
      const customerProfiles =
        await this.prismaService.customerProfile.findMany({
          where: whereClause,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            phoneNumber: true,
            ...addressInclude,
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
          ...addressInclude,
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
        const addressUpdateData: Prisma.AddressUncheckedUpdateManyInput = {};

        if (attrs.address.countryIsoCode) {
          const country = await prisma.country.findUnique({
            where: { isoCode: attrs.address.countryIsoCode },
          });
          if (!country) {
            throw new NotFoundException(
              `Country with ISO code ${attrs.address.countryIsoCode} not found`,
            );
          }
          addressUpdateData.countryId = country.id;
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
          const primaryAddress = await prisma.address.findFirst({
            where: { profileId: id, isPrimary: true },
          });
          const addressId = primaryAddress
            ? primaryAddress.id
            : (
                await prisma.address.findFirst({
                  where: { profileId: id },
                  orderBy: { id: 'asc' },
                })
              )?.id;

          if (!addressId) {
            throw new NotFoundException('No address found for this customer profile');
          }

          await prisma.address.update({
            where: { id: addressId },
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

  async toggleBlock(
    id: number,
    currentUser: UserRequestType,
  ): Promise<CustomerProfileDto> {
    const profile = await this.prismaService.customerProfile.findUnique({
      where: { id },
      select: {
        id: true,
        isActive: true,
        firstName: true,
        lastName: true,
        businessId: true,
      },
    });

    if (!profile || profile.businessId !== currentUser.businessId) {
      throw new NotFoundException('Customer profile not found');
    }

    const newIsActive = !profile.isActive;

    await this.prismaService.customerProfile.update({
      where: { id },
      data: { isActive: newIsActive },
    });

    const action = newIsActive ? AuditAction.UNBLOCK : AuditAction.BLOCK;
    await this.auditService.logUserAction(
      currentUser,
      action,
      'CustomerProfile',
      String(id),
      `${action} customer ${profile.firstName} ${profile.lastName}`,
    );

    return this.findOne(id, currentUser.businessId);
  }

  async remove(id: number, businessId: number): Promise<void> {
    await this.validateBusinessAccess(businessId);

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

  async addAddress(
    customerId: number,
    dto: AddAddressDto,
    businessId: number,
  ): Promise<CustomerProfileDto> {
    await this.validateBusinessAccess(businessId);

    const profile = await this.prismaService.customerProfile.findUnique({
      where: { id: customerId },
      select: { businessId: true, _count: { select: { addresses: true } } },
    });

    if (!profile || profile.businessId !== businessId) {
      throw new NotFoundException('Customer profile not found');
    }

    const country = await this.prismaService.country.findUnique({
      where: { isoCode: dto.countryIsoCode },
    });

    if (!country) {
      throw new NotFoundException(
        `Country with ISO code ${dto.countryIsoCode} not found`,
      );
    }

    const isFirstAddress = profile._count.addresses === 0;

    await this.prismaService.address.create({
      data: {
        street: dto.street,
        city: dto.city,
        village: dto.village,
        postcode: dto.postcode,
        region: dto.region,
        flat: dto.flat,
        building: dto.building,
        block: dto.block,
        note: dto.note,
        isPrimary: isFirstAddress ? true : (dto.isPrimary ?? false),
        businessId,
        profileId: customerId,
        countryId: country.id,
      },
    });

    return this.findOne(customerId, businessId);
  }

  async updateAddress(
    customerId: number,
    addressId: number,
    dto: UpdateAddressDto,
    businessId: number,
  ): Promise<CustomerProfileDto> {
    const address = await this.prismaService.address.findFirst({
      where: { id: addressId, profileId: customerId, businessId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    await this.prismaService.$transaction(async (prisma) => {
      const updateData: Prisma.AddressUncheckedUpdateInput = {};

      if (dto.countryIsoCode) {
        const country = await prisma.country.findUnique({
          where: { isoCode: dto.countryIsoCode },
        });
        if (!country) {
          throw new NotFoundException(`Country ${dto.countryIsoCode} not found`);
        }
        updateData.countryId = country.id;
      }

      if (dto.street !== undefined) updateData.street = dto.street;
      if (dto.city !== undefined) updateData.city = dto.city;
      if (dto.village !== undefined) updateData.village = dto.village;
      if (dto.region !== undefined) updateData.region = dto.region;
      if (dto.postcode !== undefined) updateData.postcode = dto.postcode;
      if (dto.building !== undefined) updateData.building = dto.building;
      if (dto.flat !== undefined) updateData.flat = dto.flat;

      if (Object.keys(updateData).length > 0) {
        await prisma.address.update({ where: { id: addressId }, data: updateData });
      }
    });

    return this.findOne(customerId, businessId);
  }

  async setPrimaryAddress(
    customerId: number,
    addressId: number,
    businessId: number,
  ): Promise<CustomerProfileDto> {
    await this.validateBusinessAccess(businessId);

    const profile = await this.prismaService.customerProfile.findUnique({
      where: { id: customerId },
      select: { businessId: true },
    });

    if (!profile || profile.businessId !== businessId) {
      throw new NotFoundException('Customer profile not found');
    }

    const address = await this.prismaService.address.findUnique({
      where: { id: addressId },
      select: { profileId: true },
    });

    if (!address || address.profileId !== customerId) {
      throw new NotFoundException('Address not found for this customer');
    }

    await this.prismaService.$transaction(async (prisma) => {
      await prisma.address.updateMany({
        where: { profileId: customerId },
        data: { isPrimary: false },
      });
      await prisma.address.update({
        where: { id: addressId },
        data: { isPrimary: true },
      });
    });

    return this.findOne(customerId, businessId);
  }

  async removeAddress(
    customerId: number,
    addressId: number,
    businessId: number,
  ): Promise<void> {
    await this.validateBusinessAccess(businessId);

    const profile = await this.prismaService.customerProfile.findUnique({
      where: { id: customerId },
      select: {
        businessId: true,
        _count: { select: { addresses: true } },
      },
    });

    if (!profile || profile.businessId !== businessId) {
      throw new NotFoundException('Customer profile not found');
    }

    const address = await this.prismaService.address.findUnique({
      where: { id: addressId },
      select: { profileId: true, isPrimary: true },
    });

    if (!address || address.profileId !== customerId) {
      throw new NotFoundException('Address not found for this customer');
    }

    if (address.isPrimary && profile._count.addresses > 1) {
      throw new BadRequestException(
        'Set another address as primary before deleting this one',
      );
    }

    await this.prismaService.address.delete({
      where: { id: addressId },
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
