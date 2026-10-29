import {
  validateAddressMetadata,
  validateUkraineAddress,
} from 'src/address-search/utils/address-metadata';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, AuthProvider, Prisma, UserType } from '@prisma/client';

import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCustomerProfileDto } from './dtos/create-customer-profile.dto';
import { CustomerProfileDto } from './dtos/customer-profile.dto';
import { RecipientSuggestionDto } from './dtos/recipient-suggestion.dto';
import { UpdateCustomerProfileDto } from './dtos/update-customer-profile.dto';
import { CustomerNoteDto } from './dtos/customer-note.dto';
import { GrantAccessDto } from './dtos/grant-access.dto';
import { AuditService } from 'src/audit/audit.service';
import { UserRequestType } from 'src/users/decorators/current-user.decorator';
import { BaseTenantService } from 'src/common/base-tenant.service';
import { Pagination } from 'src/dtos/pagination.dto';
import prismaWithPagination from 'src/prisma/prisma-client';
import { AddAddressDto } from 'src/addresses/dtos/add-address.dto';
import { UpdateAddressDto } from 'src/addresses/dtos/update-address.dto';
import {
  isValidUkPostcode,
  normalizeUkPostcode,
} from 'src/address-search/utils/uk-postcode';
import { SupabaseService } from 'src/supabase/supabase.service';
import {
  CreateCustomerNovaPostAddressDto,
  UpdateCustomerNovaPostAddressDto,
} from './dtos/customer-nova-post-address.dto';

const addressInclude = {
  addresses: {
    include: { country: true },
    where: { isDeleted: false },
    orderBy: [{ isPrimary: 'desc' as const }, { id: 'asc' as const }],
  },
  novaPostAddresses: {
    include: { warehouse: true },
    orderBy: [{ isDefault: 'desc' as const }, { id: 'asc' as const }],
  },
};

@Injectable()
export class CustomersService extends BaseTenantService {
  constructor(
    prismaService: PrismaService,
    private readonly auditService: AuditService,
    private readonly supabaseService: SupabaseService,
  ) {
    super(prismaService);
  }

  async createProfile(
    {
      firstName,
      lastName,
      gender,
      phoneNumber,
      addresses = [],
      novaPostAddresses = [],
    }: CreateCustomerProfileDto,
    businessId: number,
  ): Promise<CustomerProfileDto> {
    await this.validateBusinessAccess(businessId);

    for (const address of addresses) {
      validateAddressMetadata(address.countryIsoCode, address);
      validateUkraineAddress(address);
    }

    if (novaPostAddresses.filter((address) => address.isDefault).length > 1) {
      throw new BadRequestException(
        'Only one Nova Post address can be the default',
      );
    }
    if (
      new Set(novaPostAddresses.map((address) => address.warehouseId)).size !==
      novaPostAddresses.length
    ) {
      throw new BadRequestException(
        'A Nova Post warehouse can only be saved once per customer',
      );
    }

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

    const countryMap = Object.fromEntries(
      countries.map((c) => [c.isoCode, c.id]),
    );

    const existingPhone = await this.prismaService.phone.findUnique({
      where: {
        countryCode_number: {
          countryCode: phoneNumber.countryCode,
          number: phoneNumber.number,
        },
      },
      select: { id: true },
    });
    if (existingPhone) {
      throw new ConflictException(
        'Клієнт із таким номером телефону вже існує.',
      );
    }

    const createdId = await this.prismaService.$transaction(async (prisma) => {
      let phone: { id: number };
      try {
        phone = await prisma.phone.create({
          data: {
            number: phoneNumber.number,
            countryCode: phoneNumber.countryCode,
          },
          select: { id: true },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException(
            'Клієнт із таким номером телефону вже існує.',
          );
        }
        throw error;
      }

      const customerProfile = await prisma.customerProfile.create({
        data: {
          firstName,
          lastName,
          gender,
          businessId,
          phoneId: phone.id,
        },
      });

      if (addresses.length > 0) {
        await prisma.address.createMany({
          data: addresses.map((addr, i) => ({
            street: addr.street ?? addr.line1,
            line1: addr.line1,
            line2: addr.line2,
            line3: addr.line3,
            city: addr.city,
            village: addr.village,
            postcode: addr.postcode,
            region: addr.region,
            county: addr.county,
            uprn: addr.uprn,
            latitude: addr.latitude,
            longitude: addr.longitude,
            provider: addr.provider,
            providerRef: addr.providerRef,
            flat: addr.flat,
            building: addr.building,
            isPrimary: i === 0,
            businessId,
            profileId: customerProfile.id,
            countryId: countryMap[addr.countryIsoCode],
          })),
        });
      }

      if (novaPostAddresses.length > 0) {
        const warehouses = await prisma.novaPostWarehouse.findMany({
          where: {
            id: {
              in: novaPostAddresses.map((address) => address.warehouseId),
            },
            isActive: true,
          },
          select: { id: true },
        });
        if (
          warehouses.length !==
          new Set(novaPostAddresses.map((address) => address.warehouseId)).size
        ) {
          throw new BadRequestException(
            'One or more Nova Post warehouses are invalid or inactive',
          );
        }

        const hasExplicitDefault = novaPostAddresses.some(
          (address) => address.isDefault,
        );
        await prisma.customerNovaPostAddress.createMany({
          data: novaPostAddresses.map((address, index) => ({
            customerProfileId: customerProfile.id,
            warehouseId: address.warehouseId,
            label: address.label,
            note: address.note,
            recipientName: address.recipientName,
            recipientPhone: address.recipientPhone,
            isDefault: hasExplicitDefault ? !!address.isDefault : index === 0,
          })),
        });
      }

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

  async getRecipientSuggestions(
    customerId: number,
    businessId: number,
  ): Promise<RecipientSuggestionDto[]> {
    await this.validateBusinessAccess(businessId);

    const sourceCustomer = await this.prismaService.customerProfile.findFirst({
      where: {
        id: customerId,
        businessId,
        isDeleted: false,
        isActive: true,
      },
      select: { id: true },
    });
    if (!sourceCustomer) {
      throw new NotFoundException('Customer profile not found');
    }

    const [sentRelationships, receivedRelationships] = await Promise.all([
      this.prismaService.parcel.groupBy({
        by: ['recipientId'],
        where: { businessId, senderId: customerId, isDeleted: false },
        _count: { id: true },
        _max: { createdAt: true },
      }),
      this.prismaService.parcel.groupBy({
        by: ['senderId'],
        where: { businessId, recipientId: customerId, isDeleted: false },
        _count: { id: true },
        _max: { createdAt: true },
      }),
    ]);

    const relationships = new Map<
      number,
      { parcelCount: number; lastParcelAt: Date }
    >();
    const addRelationship = (
      counterpartId: number,
      parcelCount: number,
      lastParcelAt: Date | null,
    ) => {
      if (counterpartId === customerId || !lastParcelAt) return;
      const current = relationships.get(counterpartId);
      relationships.set(counterpartId, {
        parcelCount: (current?.parcelCount ?? 0) + parcelCount,
        lastParcelAt:
          !current || lastParcelAt > current.lastParcelAt
            ? lastParcelAt
            : current.lastParcelAt,
      });
    };

    sentRelationships.forEach((relationship) =>
      addRelationship(
        relationship.recipientId,
        relationship._count.id,
        relationship._max.createdAt,
      ),
    );
    receivedRelationships.forEach((relationship) =>
      addRelationship(
        relationship.senderId,
        relationship._count.id,
        relationship._max.createdAt,
      ),
    );

    if (relationships.size === 0) return [];

    const customers = await this.prismaService.customerProfile.findMany({
      where: {
        id: { in: [...relationships.keys()] },
        businessId,
        isDeleted: false,
        isActive: true,
      },
      include: {
        phoneNumber: true,
        ...addressInclude,
      },
    });
    const customersById = new Map(
      customers.map((customer) => [customer.id, customer]),
    );

    return [...relationships.entries()]
      .flatMap(([counterpartId, relationship]) => {
        const customer = customersById.get(counterpartId);
        return customer
          ? [
              new RecipientSuggestionDto({
                customer: new CustomerProfileDto(customer),
                ...relationship,
              }),
            ]
          : [];
      })
      .sort(
        (first, second) =>
          second.parcelCount - first.parcelCount ||
          second.lastParcelAt.getTime() - first.lastParcelAt.getTime() ||
          first.customer.id - second.customer.id,
      )
      .slice(0, 3);
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
            throw new NotFoundException(
              'No address found for this customer profile',
            );
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
    validateAddressMetadata(dto.countryIsoCode, dto);
    validateUkraineAddress(dto);

    const profile = await this.prismaService.customerProfile.findUnique({
      where: { id: customerId },
      select: {
        businessId: true,
        addresses: {
          where: { isActive: true, isDeleted: false },
          select: { id: true },
        },
      },
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

    const isFirstAddress = profile.addresses.length === 0;
    const makePrimary = isFirstAddress || dto.isPrimary === true;

    await this.prismaService.$transaction(async (prisma) => {
      if (makePrimary) {
        await prisma.address.updateMany({
          where: { profileId: customerId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      await prisma.address.create({
        data: {
          street: dto.street ?? dto.line1,
          line1: dto.line1,
          line2: dto.line2,
          line3: dto.line3,
          city: dto.city,
          village: dto.village,
          postcode: dto.postcode,
          region: dto.region,
          flat: dto.flat,
          building: dto.building,
          block: dto.block,
          note: dto.note,
          county: dto.county,
          uprn: dto.uprn,
          latitude: dto.latitude,
          longitude: dto.longitude,
          provider: dto.provider,
          providerRef: dto.providerRef,
          isPrimary: makePrimary,
          businessId,
          profileId: customerId,
          countryId: country.id,
        },
      });
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
      where: {
        id: addressId,
        profileId: customerId,
        businessId,
        isDeleted: false,
      },
      include: { country: true },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    await this.prismaService.$transaction(async (prisma) => {
      const updateData: Prisma.AddressUncheckedUpdateInput = {};
      const effectiveCountryIsoCode =
        dto.countryIsoCode ?? address.country.isoCode;

      validateAddressMetadata(effectiveCountryIsoCode, dto);
      if (
        effectiveCountryIsoCode === 'UA' &&
        dto.postcode != null &&
        dto.postcode !== '' &&
        !/^\d{5}$/.test(dto.postcode)
      ) {
        throw new BadRequestException(
          'Ukrainian postcode must contain five digits',
        );
      }

      if (dto.countryIsoCode) {
        const country = await prisma.country.findUnique({
          where: { isoCode: dto.countryIsoCode },
        });
        if (!country) {
          throw new NotFoundException(
            `Country ${dto.countryIsoCode} not found`,
          );
        }
        updateData.countryId = country.id;
      }

      if (dto.street !== undefined) updateData.street = dto.street;
      if (dto.city !== undefined) updateData.city = dto.city;
      if (dto.village !== undefined) updateData.village = dto.village;
      if (dto.region !== undefined) updateData.region = dto.region;
      if (dto.postcode !== undefined) {
        const postcode =
          effectiveCountryIsoCode === 'GB'
            ? normalizeUkPostcode(dto.postcode)
            : dto.postcode;
        if (effectiveCountryIsoCode === 'GB' && !isValidUkPostcode(postcode)) {
          throw new BadRequestException('Invalid UK postcode');
        }
        updateData.postcode = postcode;
      }
      if (dto.building !== undefined) updateData.building = dto.building;
      if (dto.flat !== undefined) updateData.flat = dto.flat;
      if (dto.block !== undefined) updateData.block = dto.block;
      if (dto.note !== undefined) updateData.note = dto.note;
      if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
      if (dto.line1 !== undefined) updateData.line1 = dto.line1;
      if (dto.line2 !== undefined) updateData.line2 = dto.line2;
      if (dto.line3 !== undefined) updateData.line3 = dto.line3;
      if (dto.county !== undefined) updateData.county = dto.county;
      if (dto.uprn !== undefined) updateData.uprn = dto.uprn;
      if (dto.latitude !== undefined) updateData.latitude = dto.latitude;
      if (dto.longitude !== undefined) updateData.longitude = dto.longitude;
      if (dto.provider !== undefined) updateData.provider = dto.provider;
      if (dto.providerRef !== undefined)
        updateData.providerRef = dto.providerRef;

      const physicalFields: (keyof UpdateAddressDto)[] = [
        'street',
        'city',
        'village',
        'region',
        'postcode',
        'building',
        'block',
        'line1',
        'line2',
        'line3',
        'county',
        'countryIsoCode',
      ];
      const meaningfulAddressChanged = physicalFields.some((field) => {
        const next = dto[field];
        if (next === undefined) return false;
        const previous =
          field === 'countryIsoCode'
            ? address.country.isoCode
            : address[field as keyof typeof address];
        return next !== previous;
      });
      if (meaningfulAddressChanged) {
        // A physical edit invalidates the lookup provenance, even when a client
        // submits the unchanged provider fields alongside the edited address.
        updateData.provider = null;
        updateData.providerRef = null;
        updateData.uprn = null;
        updateData.latitude = null;
        updateData.longitude = null;
      }

      if (address.isPrimary && dto.isActive === false) {
        const otherActiveAddresses = await prisma.address.count({
          where: {
            profileId: customerId,
            id: { not: addressId },
            isActive: true,
            isDeleted: false,
          },
        });
        if (otherActiveAddresses > 0) {
          throw new BadRequestException(
            'Set another address as primary before deactivating this one',
          );
        }
        updateData.isPrimary = false;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.address.update({
          where: { id: addressId },
          data: updateData,
        });
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
      select: { profileId: true, isActive: true, isDeleted: true },
    });

    if (
      !address ||
      address.profileId !== customerId ||
      !address.isActive ||
      address.isDeleted
    ) {
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
        addresses: {
          where: { isActive: true, isDeleted: false },
          select: { id: true },
        },
      },
    });

    if (!profile || profile.businessId !== businessId) {
      throw new NotFoundException('Customer profile not found');
    }

    const address = await this.prismaService.address.findUnique({
      where: { id: addressId },
      select: { profileId: true, isPrimary: true, isDeleted: true },
    });

    if (!address || address.profileId !== customerId || address.isDeleted) {
      throw new NotFoundException('Address not found for this customer');
    }

    if (address.isPrimary && profile.addresses.length > 1) {
      throw new BadRequestException(
        'Set another address as primary before deleting this one',
      );
    }

    await this.prismaService.address.update({
      where: { id: addressId },
      data: { isDeleted: true, isActive: false, isPrimary: false },
    });
  }

  async getDestinations(customerId: number, businessId: number) {
    await this.validateBusinessAccess(businessId);
    const profile = await this.prismaService.customerProfile.findFirst({
      where: { id: customerId, businessId, isDeleted: false },
      select: {
        addresses: {
          where: { isActive: true, isDeleted: false },
          include: { country: true },
          orderBy: [{ isPrimary: 'desc' }, { id: 'asc' }],
        },
        novaPostAddresses: {
          where: { warehouse: { isActive: true } },
          include: { warehouse: true },
          orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
        },
      },
    });
    if (!profile) throw new NotFoundException('Customer profile not found');

    return {
      addresses: profile.addresses,
      novaPostAddresses: profile.novaPostAddresses,
      primaryAddressId:
        profile.addresses.find((address) => address.isPrimary)?.id ?? null,
      defaultNovaPostAddressId:
        profile.novaPostAddresses.find((address) => address.isDefault)?.id ??
        null,
    };
  }

  async addNovaPostAddress(
    customerId: number,
    dto: CreateCustomerNovaPostAddressDto,
    businessId: number,
  ): Promise<CustomerProfileDto> {
    await this.validateBusinessAccess(businessId);
    const [profile, warehouse] = await Promise.all([
      this.prismaService.customerProfile.findFirst({
        where: { id: customerId, businessId, isDeleted: false },
        select: {
          id: true,
          _count: { select: { novaPostAddresses: true } },
          novaPostAddresses: {
            where: { warehouseId: dto.warehouseId },
            select: { id: true },
          },
        },
      }),
      this.prismaService.novaPostWarehouse.findFirst({
        where: { id: dto.warehouseId, isActive: true },
        select: { id: true },
      }),
    ]);
    if (!profile) throw new NotFoundException('Customer profile not found');
    if (!warehouse) {
      throw new BadRequestException(
        'Nova Post warehouse is inactive or invalid',
      );
    }
    if (profile.novaPostAddresses.length > 0) {
      throw new ConflictException(
        'This Nova Post warehouse is already saved for the customer',
      );
    }

    const makeDefault =
      profile._count.novaPostAddresses === 0 || dto.isDefault === true;
    await this.prismaService.$transaction(async (prisma) => {
      if (makeDefault) {
        await prisma.customerNovaPostAddress.updateMany({
          where: { customerProfileId: customerId, isDefault: true },
          data: { isDefault: false },
        });
      }
      await prisma.customerNovaPostAddress.create({
        data: {
          customerProfileId: customerId,
          warehouseId: dto.warehouseId,
          label: dto.label,
          note: dto.note,
          recipientName: dto.recipientName,
          recipientPhone: dto.recipientPhone,
          isDefault: makeDefault,
        },
      });
    });
    return this.findOne(customerId, businessId);
  }

  async updateNovaPostAddress(
    customerId: number,
    addressId: number,
    dto: UpdateCustomerNovaPostAddressDto,
    businessId: number,
  ): Promise<CustomerProfileDto> {
    await this.validateNovaPostAddress(customerId, addressId, businessId);
    await this.prismaService.customerNovaPostAddress.update({
      where: { id: addressId },
      data: dto,
    });
    return this.findOne(customerId, businessId);
  }

  async setDefaultNovaPostAddress(
    customerId: number,
    addressId: number,
    businessId: number,
  ): Promise<CustomerProfileDto> {
    await this.validateNovaPostAddress(customerId, addressId, businessId, true);
    await this.prismaService.$transaction(async (prisma) => {
      await prisma.customerNovaPostAddress.updateMany({
        where: { customerProfileId: customerId, isDefault: true },
        data: { isDefault: false },
      });
      await prisma.customerNovaPostAddress.update({
        where: { id: addressId, customerProfileId: customerId },
        data: { isDefault: true },
      });
    });
    return this.findOne(customerId, businessId);
  }

  async removeNovaPostAddress(
    customerId: number,
    addressId: number,
    businessId: number,
  ): Promise<void> {
    const address = await this.validateNovaPostAddress(
      customerId,
      addressId,
      businessId,
    );
    if (address._count.destinationParcels + address._count.originParcels > 0) {
      throw new ConflictException('This saved address is used by a parcel');
    }
    const count = await this.prismaService.customerNovaPostAddress.count({
      where: { customerProfileId: customerId },
    });
    if (address.isDefault && count > 1) {
      throw new BadRequestException(
        'Set another Nova Post address as default before deleting this one',
      );
    }
    await this.prismaService.customerNovaPostAddress.delete({
      where: { id: addressId },
    });
  }

  private async validateNovaPostAddress(
    customerId: number,
    addressId: number,
    businessId: number,
    requireActiveWarehouse = false,
  ) {
    const address = await this.prismaService.customerNovaPostAddress.findFirst({
      where: {
        id: addressId,
        customerProfileId: customerId,
        customerProfile: { businessId, isDeleted: false },
        ...(requireActiveWarehouse ? { warehouse: { isActive: true } } : {}),
      },
      include: {
        _count: {
          select: { destinationParcels: true, originParcels: true },
        },
      },
    });
    if (!address) {
      throw new NotFoundException('Saved Nova Post address not found');
    }
    return address;
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

  async grantAccess(
    customerProfileId: number,
    dto: GrantAccessDto,
    currentUser: UserRequestType,
  ): Promise<CustomerProfileDto> {
    const profile = await this.prismaService.customerProfile.findUnique({
      where: { id: customerProfileId },
      include: { user: true },
    });

    if (!profile || profile.businessId !== currentUser.businessId) {
      throw new NotFoundException('Customer profile not found');
    }

    if (profile.user) {
      throw new ConflictException(
        'This customer profile already has an account',
      );
    }

    const { data: authData, error } =
      await this.supabaseService.client.auth.admin.createUser({
        email: dto.email,
        password: dto.temporaryPassword,
        email_confirm: true,
      });

    if (error || !authData.user) {
      throw new BadRequestException(
        error?.message || 'Failed to create Supabase user',
      );
    }

    await this.prismaService.$transaction(async (prisma) => {
      const user = await prisma.user.create({
        data: {
          email: dto.email,
          firstName: profile.firstName ?? null,
          lastName: profile.lastName ?? null,
          type: UserType.Customer,
          businessId: currentUser.businessId,
          customerProfileId: profile.id,
        },
      });

      await prisma.authProfile.create({
        data: {
          userId: user.id,
          provider: AuthProvider.Supabase,
          providerId: authData.user.id,
          email: dto.email,
          lastSignIn: new Date(),
        },
      });

      await prisma.customerProfile.update({
        where: { id: profile.id },
        data: { email: dto.email },
      });
    });

    return this.findOne(customerProfileId, currentUser.businessId);
  }
}
