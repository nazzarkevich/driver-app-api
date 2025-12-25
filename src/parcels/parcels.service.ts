import { Injectable, NotFoundException } from '@nestjs/common';

import { ParcelDto } from './dtos/parcel.dto';
import { ParcelNoteDto } from './dtos/parcel-note.dto';
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
import { TariffsService } from 'src/tariffs/tariffs.service';
import { CreateBulkParcelsDto } from './dtos/create-bulk-parcels.dto';
import { AuditService } from 'src/audit/audit.service';
import { AuditAction } from '@prisma/client';

@Injectable()
export class ParcelsService extends BaseTenantService {
  constructor(
    prismaService: PrismaService,
    private readonly usersService: UsersService,
    private readonly connectedParcelsService: ConnectedParcelsService,
    private readonly tariffsService: TariffsService,
    private readonly auditService: AuditService,
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

    // Extract only valid CreateParcelDto properties
    const {
      weight,
      price,
      cost,
      parcelMoneyAmount,
      discount,
      discountType,
      cargoType,
      paymentStatus,
      paidBy,
      senderId,
      recipientId,
      recipientPhoneNumber,
      senderPhoneNumber,
      journeyId,
      originAddressId,
      destinationAddressId,
      tariffId,
    } = body;

    let calculatedPrice = price;
    if (tariffId) {
      calculatedPrice = await this.tariffsService.calculatePrice(
        weight,
        tariffId,
        cargoType,
      );
    }

    const newParcel = await this.prismaService.parcel.create({
      data: {
        weight,
        price: calculatedPrice,
        cost,
        parcelMoneyAmount,
        discount,
        discountType,
        cargoType,
        paymentStatus,
        paidBy,
        pickupDate: new Date(),
        senderId,
        recipientId,
        recipientPhoneNumber,
        senderPhoneNumber,
        journeyId,
        originAddressId,
        destinationAddressId,
        tariffId,
        businessId: user.businessId,
        trackingNumber: this.generateTrackingNumber(),
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
    deliveryStatus?: string,
    trackingNumber?: string,
    senderId?: number,
    recipientId?: number,
    startDate?: Date,
    endDate?: Date,
    originCountryId?: number,
    destinationCountryId?: number,
    search?: string,
    cargoType?: string,
    paymentStatus?: string,
  ): Promise<Pagination<ParcelDto> | ParcelDto[]> {
    await this.validateBusinessAccess(businessId, currentUser);

    const baseWhere = this.getBusinessWhere(businessId, {}, currentUser);
    const conditions: any[] = [];

    if (deliveryStatus && deliveryStatus.trim() !== '') {
      conditions.push({ deliveryStatus: deliveryStatus });
    }

    if (trackingNumber) {
      conditions.push({
        trackingNumber: {
          contains: trackingNumber,
          mode: 'insensitive',
        },
      });
    }

    if (senderId) {
      conditions.push({ senderId });
    }

    if (recipientId) {
      conditions.push({ recipientId });
    }

    if (startDate || endDate) {
      conditions.push({
        createdAt: {
          ...(startDate && { gte: startDate }),
          ...(endDate && {
            lte: new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1),
          }),
        },
      });
    }

    if (originCountryId) {
      conditions.push({
        originAddress: {
          countryId: originCountryId,
        },
      });
    }

    if (destinationCountryId) {
      conditions.push({
        destinationAddress: {
          countryId: destinationCountryId,
        },
      });
    }

    if (cargoType && cargoType.trim() !== '') {
      const cargoTypes = cargoType.split(',').map((type) => type.trim());
      conditions.push({
        cargoType: {
          in: cargoTypes,
        },
      });
    }

    if (paymentStatus && paymentStatus.trim() !== '') {
      const paymentStatuses = paymentStatus
        .split(',')
        .map((status) => status.trim());
      conditions.push({
        paymentStatus: {
          in: paymentStatuses,
        },
      });
    }

    if (search) {
      conditions.push({
        OR: [
          { trackingNumber: { contains: search, mode: 'insensitive' } },
          {
            originAddress: {
              OR: [
                { street: { contains: search, mode: 'insensitive' } },
                { city: { contains: search, mode: 'insensitive' } },
                { village: { contains: search, mode: 'insensitive' } },
                { postcode: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
          {
            destinationAddress: {
              OR: [
                { street: { contains: search, mode: 'insensitive' } },
                { city: { contains: search, mode: 'insensitive' } },
                { village: { contains: search, mode: 'insensitive' } },
                { postcode: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
          {
            sender: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
          {
            recipient: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        ],
      });
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

  async createBulk(
    user: UserRequestType,
    body: CreateBulkParcelsDto,
  ): Promise<ParcelDto[]> {
    await this.validateBusinessAccess(user.businessId, user);

    const {
      senderId,
      recipientId,
      senderPhoneNumber,
      recipientPhoneNumber,
      originAddressId,
      destinationAddressId,
      journeyId,
      pickupDate,
      parcels,
    } = body;

    return await this.prismaService.$transaction(async (tx) => {
      const createdParcels = [];

      for (const parcelItem of parcels) {
        const parcel = await tx.parcel.create({
          data: {
            weight: parcelItem.weight,
            price: parcelItem.price,
            cost: parcelItem.cost,
            cargoType: parcelItem.cargoType,
            paymentStatus: parcelItem.paymentStatus,
            paidBy: parcelItem.paidBy,
            tariffId: parcelItem.tariffId,
            parcelMoneyAmount: parcelItem.parcelMoneyAmount,
            discount: parcelItem.discount,
            discountType: parcelItem.discountType,
            hasBorderCheck: parcelItem.hasBorderCheck,
            senderId,
            recipientId,
            senderPhoneNumber,
            recipientPhoneNumber,
            originAddressId,
            destinationAddressId,
            journeyId,
            pickupDate,
            businessId: user.businessId,
            trackingNumber: this.generateTrackingNumber(),
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
          },
        });

        createdParcels.push(parcel);
      }

      if (createdParcels.length > 1) {
        for (let i = 0; i < createdParcels.length; i++) {
          for (let j = i + 1; j < createdParcels.length; j++) {
            await tx.connectedParcel.create({
              data: {
                parcelId: createdParcels[i].id,
                connectedToId: createdParcels[j].id,
                connectionType: 'batch',
              },
            });
          }
        }
      }

      await this.auditService.log({
        userId: user.id,
        action: AuditAction.CREATE,
        entityType: 'Parcel',
        description: `Bulk created ${createdParcels.length} parcels`,
        metadata: {
          parcelCount: createdParcels.length,
          parcelIds: createdParcels.map((p) => p.id),
          trackingNumbers: createdParcels.map((p) => p.trackingNumber),
          senderId,
          recipientId,
          linked: createdParcels.length > 1,
        },
        businessId: user.businessId,
      });

      return createdParcels.map((parcel) => new ParcelDto(parcel));
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

  async addNote(
    parcelId: number,
    content: string,
    userId: number,
    businessId: number,
  ): Promise<ParcelNoteDto> {
    await this.validateBusinessAccess(businessId);

    const parcel = await this.prismaService.parcel.findUnique({
      where: { id: parcelId },
      select: { businessId: true },
    });

    if (!parcel || parcel.businessId !== businessId) {
      throw new NotFoundException('Parcel not found');
    }

    const note = await this.prismaService.parcelNote.create({
      data: {
        content,
        parcelId,
        userId,
      },
      include: {
        user: true,
      },
    });

    return new ParcelNoteDto(note);
  }

  async getNotes(
    parcelId: number,
    businessId: number,
  ): Promise<ParcelNoteDto[]> {
    await this.validateBusinessAccess(businessId);

    const parcel = await this.prismaService.parcel.findUnique({
      where: { id: parcelId },
      select: { businessId: true },
    });

    if (!parcel || parcel.businessId !== businessId) {
      throw new NotFoundException('Parcel not found');
    }

    const notes = await this.prismaService.parcelNote.findMany({
      where: { parcelId },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return notes.map((note) => new ParcelNoteDto(note));
  }

  async deleteNote(
    noteId: number,
    userId: number,
    businessId: number,
  ): Promise<void> {
    await this.validateBusinessAccess(businessId);

    const note = await this.prismaService.parcelNote.findUnique({
      where: { id: noteId },
      include: {
        parcel: {
          select: { businessId: true },
        },
      },
    });

    if (!note || note.parcel.businessId !== businessId) {
      throw new NotFoundException('Note not found');
    }

    if (note.userId !== userId) {
      throw new NotFoundException(
        'You can only delete notes that you created',
      );
    }

    await this.prismaService.parcelNote.delete({
      where: { id: noteId },
    });
  }
}
