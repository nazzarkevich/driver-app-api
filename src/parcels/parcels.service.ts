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

@Injectable()
export class ParcelsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly usersService: UsersService,
    private readonly connectedParcelsService: ConnectedParcelsService,
  ) {}

  /* 
    TODO: Question:
      multiple createParcel requests will create duplicate parcels each with uniq tracking number
      Not sure what to do with it.
  */

  async createParcel(
    user: UserRequestType,
    body: CreateParcelDto,
  ): Promise<{ id: number; trackingNumber: string }> {
    const currentUser = await this.usersService.findOne(user.id);

    const newParcel = await this.prismaService.parcel.create({
      data: {
        ...body,
        businessId: currentUser.businessId,
        trackingNumber: this.generateTrackingNumber(),
        pickupDate: new Date(),
      },
    });

    // Auto-connect with similar parcels
    const connectionCriteria: ConnectionCriteria = {
      senderId: body.senderId,
      destinationAddressId: body.destinationAddressId,
      timeWindow: 24, // Connect parcels created within 24 hours
      businessId: currentUser.businessId,
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

  async findParcels(page: number): Promise<Pagination<ParcelDto>> {
    const [parcelsWithPagination, metadata] = await prismaWithPagination.parcel
      .paginate({
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          sender: true,
          recipient: true,
          connections: {
            include: {
              connectedTo: {
                select: { id: true, trackingNumber: true },
              },
            },
          },
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
  }

  async findParcelsByIds(parcelsIds: number[]): Promise<ParcelDto[]> {
    if (parcelsIds?.length === 0) {
      return [];
    }

    // TODO: Question: Where is the best place to error handle this?
    try {
      const parcels = await this.prismaService.parcel.findMany({
        where: {
          id: {
            in: parcelsIds,
          },
        },
      });

      return parcels.map((parcel) => new ParcelDto(parcel));
    } catch (error) {
      throw new NotFoundException(error);
    }
  }

  async findParcel(id: number): Promise<ParcelDto> {
    const parcel = await this.prismaService.parcel.findUnique({
      where: {
        id,
      },
      include: {
        connections: {
          include: {
            connectedTo: {
              include: {
                sender: true,
                recipient: true,
              },
            },
          },
        },
      },
    });

    if (!parcel) {
      throw new NotFoundException();
    }

    return new ParcelDto(parcel);
  }

  async updateParcel(
    id: number,
    attrs: Partial<UpdateParcelDto>,
  ): Promise<ParcelDto> {
    const parcel = await this.findParcel(id);

    if (!parcel) {
      throw new Error('Parcel not found');
    }

    Object.assign(parcel, attrs);

    const updatedParcel = await this.prismaService.parcel.update({
      where: {
        id,
      },
      data: attrs,
    });

    return new ParcelDto(updatedParcel);
  }

  async removeParcel(id: number): Promise<void> {
    await this.prismaService.parcel.delete({
      where: {
        id,
      },
    });
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
