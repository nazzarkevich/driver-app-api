import { Injectable, NotFoundException } from '@nestjs/common';

import { ParcelDto } from './dtos/parcel.dto';
import { Pagination } from 'src/dtos/pagination.dto';
import { UsersService } from 'src/users/users.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateParcelDto } from './dtos/create-parcel.dto';
import { UpdateParcelDto } from './dtos/update-parcel.dto';
import prismaWithPagination from 'src/prisma/prisma-client';
import { UserRequestType } from 'src/users/decorators/current-user.decorator';
import {
  ConnectedParcelsService,
  ConnectionCriteria,
} from './connected-parcels.service';
import { BaseTenantService } from 'src/common/base-tenant.service';

@Injectable()
export class ParcelsService extends BaseTenantService {
  constructor(
    prismaService: PrismaService,
    private readonly usersService: UsersService,
    private readonly connectedParcelsService: ConnectedParcelsService,
  ) {
    super(prismaService);
  }

  /* 
    TODO: Question:
      multiple createParcel requests will create duplicate parcels each with uniq tracking number
      Not sure what to do with it.
  */

  async createParcel(
    user: UserRequestType,
    body: CreateParcelDto,
  ): Promise<{ id: number; trackingNumber: string }> {
    await this.validateBusinessAccess(user.businessId);

    const newParcel = await this.prismaService.parcel.create({
      data: {
        ...body,
        businessId: user.businessId,
        trackingNumber: this.generateTrackingNumber(),
        pickupDate: new Date(),
      },
    });

    // Auto-connect with similar parcels
    const connectionCriteria: ConnectionCriteria = {
      senderId: body.senderId,
      destinationAddressId: body.destinationAddressId,
      timeWindow: 24, // Connect parcels created within 24 hours
      businessId: user.businessId,
    };

    try {
      await this.connectedParcelsService.autoConnectParcels(
        newParcel.id,
        connectionCriteria,
      );
    } catch (error) {
      // Log error but don't fail parcel creation
      console.warn('Failed to auto-connect parcel:', error);
    }

    return {
      id: newParcel.id,
      trackingNumber: newParcel.trackingNumber,
    };
  }

  async findAll(
    businessId: number,
    currentUser?: UserRequestType,
    page?: number,
  ): Promise<Pagination<ParcelDto> | ParcelDto[]> {
    await this.validateBusinessAccess(businessId, currentUser);

    const whereClause = this.getBusinessWhere(businessId, {}, currentUser);

    if (page) {
      // Return paginated results
      const [parcelsWithPagination, metadata] =
        await prismaWithPagination.parcel
          .paginate({
            orderBy: {
              createdAt: 'desc',
            },
            where: whereClause,
            include: {
              sender: true,
              recipient: true,
              originAddress: {
                include: {
                  country: true,
                },
              },
              destinationAddress: {
                include: {
                  country: true,
                },
              },
              business: currentUser?.isSuperAdmin ? true : false, // Include business info for SuperAdmin
            },
          })
          .withPages({ page });

      const parcels = parcelsWithPagination.map(
        (parcel) => new ParcelDto(parcel),
      );

      return {
        items: parcels,
        ...metadata,
      };
    } else {
      // Return all results
      const allParcels = await this.prismaService.parcel.findMany({
        where: whereClause,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          sender: true,
          recipient: true,
          originAddress: {
            include: {
              country: true,
            },
          },
          destinationAddress: {
            include: {
              country: true,
            },
          },
          business: currentUser?.isSuperAdmin ? true : false, // Include business info for SuperAdmin
        },
      });

      return allParcels.map((parcel) => new ParcelDto(parcel));
    }
  }

  async findOne(
    id: number,
    businessId: number,
    currentUser?: UserRequestType,
  ): Promise<ParcelDto> {
    await this.validateBusinessAccess(businessId, currentUser);

    const parcel = await this.prismaService.parcel.findUnique({
      where: {
        id,
      },
      include: {
        sender: true,
        recipient: true,
        originAddress: {
          include: {
            country: true,
          },
        },
        destinationAddress: {
          include: {
            country: true,
          },
        },
        business: currentUser?.isSuperAdmin ? true : false, // Include business info for SuperAdmin
      },
    });

    if (!parcel || !this.canAccessBusiness(parcel.businessId, currentUser)) {
      throw new NotFoundException('Parcel not found');
    }

    return new ParcelDto(parcel);
  }

  async update(
    id: number,
    attrs: Partial<UpdateParcelDto>,
    businessId: number,
    currentUser?: UserRequestType,
  ): Promise<ParcelDto> {
    const parcel = await this.findOne(id, businessId, currentUser);

    if (!parcel) {
      throw new Error('Parcel not found');
    }

    Object.assign(parcel, attrs);

    const updatedParcel = await this.prismaService.parcel.update({
      where: {
        id,
      },
      data: attrs,
      include: {
        sender: true,
        recipient: true,
        originAddress: {
          include: {
            country: true,
          },
        },
        destinationAddress: {
          include: {
            country: true,
          },
        },
        business: currentUser?.isSuperAdmin ? true : false,
      },
    });

    return new ParcelDto(updatedParcel);
  }

  async remove(
    id: number,
    businessId: number,
    currentUser?: UserRequestType,
  ): Promise<void> {
    await this.validateBusinessAccess(businessId, currentUser);

    // First check if parcel belongs to the accessible business
    const parcel = await this.prismaService.parcel.findUnique({
      where: { id },
      select: { businessId: true },
    });

    if (!parcel || !this.canAccessBusiness(parcel.businessId, currentUser)) {
      throw new NotFoundException('Parcel not found');
    }

    await this.prismaService.parcel.delete({
      where: {
        id,
      },
    });
  }

  // SuperAdmin-only method for cross-business operations
  async findAcrossBusinesses(
    businessIds: number[],
    currentUser: UserRequestType,
  ): Promise<ParcelDto[]> {
    if (!currentUser.isSuperAdmin) {
      throw new NotFoundException('Access denied');
    }

    const parcels = await this.prismaService.parcel.findMany({
      where: { businessId: { in: businessIds } },
      include: {
        sender: true,
        recipient: true,
        originAddress: {
          include: {
            country: true,
          },
        },
        destinationAddress: {
          include: {
            country: true,
          },
        },
        business: true, // Always include business info for cross-business queries
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return parcels.map((parcel) => new ParcelDto(parcel));
  }

  async findParcelsByIds(
    parcelsIds: number[],
    businessId: number,
    currentUser?: UserRequestType,
  ): Promise<ParcelDto[]> {
    if (parcelsIds?.length === 0) {
      return [];
    }

    await this.validateBusinessAccess(businessId, currentUser);

    try {
      const parcels = await this.prismaService.parcel.findMany({
        where: this.getBusinessWhere(
          businessId,
          {
            id: {
              in: parcelsIds,
            },
          },
          currentUser,
        ),
        include: {
          sender: true,
          recipient: true,
          originAddress: {
            include: {
              country: true,
            },
          },
          destinationAddress: {
            include: {
              country: true,
            },
          },
        },
      });

      return parcels.map((parcel) => new ParcelDto(parcel));
    } catch (error) {
      throw new NotFoundException(error);
    }
  }

  private generateTrackingNumber() {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0'); // January is 0!
    const year = today.getFullYear();
    const currentDate = day + month + year;

    const randomSuffix = Math.floor(Math.random() * 1000000000000)
      .toString()
      .padStart(13, '0');

    return currentDate + randomSuffix;
  }
}
