import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { ParcelDto } from './dtos/parcel.dto';
import { ParcelNoteDto } from './dtos/parcel-note.dto';
import { Pagination } from 'src/dtos/pagination.dto';
import { UsersService } from 'src/users/users.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateParcelDto } from './dtos/create-parcel.dto';
import { UpdateParcelDto } from './dtos/update-parcel.dto';
import prismaWithPagination from 'src/prisma/prisma-client';
import { UserRequestType } from 'src/users/decorators/current-user.decorator';
import { BaseTenantService } from 'src/common/base-tenant.service';
import { TariffsService } from 'src/tariffs/tariffs.service';
import { CreateBulkParcelsDto } from './dtos/create-bulk-parcels.dto';
import { AuditService } from 'src/audit/audit.service';
import { AuditAction, DeliveryStatus, DiscountType } from '@prisma/client';

@Injectable()
export class ParcelsService extends BaseTenantService {
  constructor(
    prismaService: PrismaService,
    private readonly usersService: UsersService,
    private readonly tariffsService: TariffsService,
    private readonly auditService: AuditService,
  ) {
    super(prismaService);
  }

  async createParcel(
    user: UserRequestType,
    body: CreateParcelDto,
  ): Promise<{ id: number; trackingNumber: string }> {
    await this.validateBusinessAccess(user.businessId);

    const {
      weight,
      price,
      cost,
      parcelMoneyAmount,
      discount,
      discountType,
      parcelType,
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

    let basePrice = price;
    if (tariffId) {
      basePrice = await this.tariffsService.calculatePrice(tariffId, weight);
    }

    let finalPrice = basePrice;
    if (discount && discountType && discountType !== DiscountType.None) {
      if (discountType === DiscountType.Percentage) {
        finalPrice = parseFloat((basePrice * (1 - discount / 100)).toFixed(2));
      } else if (discountType === DiscountType.FixedAmount) {
        finalPrice = parseFloat(Math.max(0, basePrice - discount).toFixed(2));
      }
    }

    const profile = await this.resolveUserProfile(user.id);

    const newParcel = await this.prismaService.parcel.create({
      data: {
        weight,
        price: finalPrice,
        calculatedPrice: basePrice,
        cost,
        parcelMoneyAmount,
        discount,
        discountType,
        parcelType,
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
        pickedUpByCourierId: profile.courierId,
        pickedUpByDriverId: profile.driverId,
        pickedUpAt: new Date(),
      },
    });

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
    courierId?: number,
    driverId?: number,
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

    if (courierId) {
      conditions.push({
        OR: [
          { pickedUpByCourierId: courierId },
          { deliveredByCourierId: courierId },
        ],
      });
    }

    if (driverId) {
      conditions.push({
        OR: [
          { pickedUpByDriverId: driverId },
          { deliveredByDriverId: driverId },
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
              business: currentUser?.isSuperAdmin ? true : false,
              _count: {
                select: { parcelNotes: true },
              },
            },
          })
          .withPages({ page });

      const parcelsWithGroupSize = await this.attachGroupSize(
        parcelsWithPagination,
      );

      const parcels = parcelsWithGroupSize.map((parcel) => new ParcelDto(parcel));

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
          business: currentUser?.isSuperAdmin ? true : false,
        },
      });

      const parcelsWithGroupSize = await this.attachGroupSize(allParcels);
      return parcelsWithGroupSize.map((parcel) => new ParcelDto(parcel));
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
        pickedUpByCourier: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        pickedUpByDriver: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        deliveredByCourier: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        deliveredByDriver: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        business: currentUser?.isSuperAdmin ? true : false,
      },
    });

    if (!parcel || !this.canAccessBusiness(parcel.businessId, currentUser)) {
      throw new NotFoundException('Parcel not found');
    }

    const groupSize = parcel.groupId
      ? await this.prismaService.parcel.count({
          where: { groupId: parcel.groupId, isDeleted: false },
        })
      : 1;

    return new ParcelDto({ ...parcel, groupSize });
  }

  async findGroup(
    id: number,
    businessId: number,
    currentUser?: UserRequestType,
  ): Promise<ParcelDto[]> {
    await this.validateBusinessAccess(businessId, currentUser);

    const parcel = await this.prismaService.parcel.findUnique({
      where: { id },
      select: { groupId: true, businessId: true },
    });

    if (!parcel || !this.canAccessBusiness(parcel.businessId, currentUser)) {
      throw new NotFoundException('Parcel not found');
    }

    if (!parcel.groupId) {
      return [];
    }

    const siblings = await this.prismaService.parcel.findMany({
      where: {
        groupId: parcel.groupId,
        isDeleted: false,
        NOT: { id },
      },
      include: {
        sender: true,
        recipient: true,
        originAddress: { include: { country: true } },
        destinationAddress: { include: { country: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const groupSize = siblings.length + 1;
    return siblings.map((p) => new ParcelDto({ ...p, groupSize }));
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

    const updateData: Partial<UpdateParcelDto> & {
      price?: number;
      calculatedPrice?: number;
    } = { ...attrs };

    if (attrs.discount !== undefined || attrs.discountType !== undefined) {
      const current = await this.prismaService.parcel.findUnique({
        where: { id },
        select: {
          calculatedPrice: true,
          price: true,
          discount: true,
          discountType: true,
        },
      });
      const base = current.calculatedPrice ?? current.price;
      const discount = attrs.discount ?? current.discount;
      const discountType = attrs.discountType ?? current.discountType;

      if (discountType === DiscountType.Percentage) {
        updateData.price = parseFloat((base * (1 - discount / 100)).toFixed(2));
      } else if (discountType === DiscountType.FixedAmount) {
        updateData.price = parseFloat(Math.max(0, base - discount).toFixed(2));
      } else {
        updateData.price = base;
      }
      updateData.calculatedPrice = base;
    }

    const updatedParcel = await this.prismaService.parcel.update({
      where: {
        id,
      },
      data: updateData,
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
        pickedUpByCourier: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        pickedUpByDriver: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        deliveredByCourier: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        deliveredByDriver: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
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

    const groupId = parcels.length > 1 ? randomUUID() : null;

    return await this.prismaService.$transaction(async (tx) => {
      const createdParcels = [];

      for (const parcelItem of parcels) {
        const basePrice = parcelItem.price;
        let finalPrice = basePrice;
        if (
          parcelItem.discount &&
          parcelItem.discountType &&
          parcelItem.discountType !== DiscountType.None
        ) {
          if (parcelItem.discountType === DiscountType.Percentage) {
            finalPrice = parseFloat(
              (basePrice * (1 - parcelItem.discount / 100)).toFixed(2),
            );
          } else if (parcelItem.discountType === DiscountType.FixedAmount) {
            finalPrice = parseFloat(
              Math.max(0, basePrice - parcelItem.discount).toFixed(2),
            );
          }
        }

        const parcel = await tx.parcel.create({
          data: {
            weight: parcelItem.weight,
            price: finalPrice,
            calculatedPrice: basePrice,
            cost: parcelItem.cost,
            parcelType: parcelItem.parcelType,
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
            groupId,
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
          groupId,
        },
        businessId: user.businessId,
      });

      return createdParcels.map((parcel) =>
        new ParcelDto({ ...parcel, groupSize: createdParcels.length }),
      );
    });
  }

  private async attachGroupSize<T extends { groupId?: string | null; id: number }>(
    parcels: T[],
  ): Promise<(T & { groupSize: number })[]> {
    const groupIds = [
      ...new Set(parcels.map((p) => p.groupId).filter(Boolean)),
    ] as string[];

    if (groupIds.length === 0) {
      return parcels.map((p) => ({ ...p, groupSize: 1 }));
    }

    const counts = await this.prismaService.parcel.groupBy({
      by: ['groupId'],
      where: { groupId: { in: groupIds }, isDeleted: false },
      _count: { id: true },
    });

    const countMap = new Map(counts.map((c) => [c.groupId, c._count.id]));

    return parcels.map((p) => ({
      ...p,
      groupSize: p.groupId ? (countMap.get(p.groupId) ?? 1) : 1,
    }));
  }

  private generateTrackingNumber() {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const currentDate = day + month + year;

    const randomSuffix = Math.floor(Math.random() * 1000000000000)
      .toString()
      .padStart(13, '0');

    return currentDate + randomSuffix;
  }

  private async resolveUserProfile(
    userId: number,
  ): Promise<{ courierId?: number; driverId?: number }> {
    const courier = await this.prismaService.courierProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (courier) return { courierId: courier.id };

    const driver = await this.prismaService.driverProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (driver) return { driverId: driver.id };

    throw new NotFoundException('User has no courier or driver profile');
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
      throw new NotFoundException('You can only delete notes that you created');
    }

    await this.prismaService.parcelNote.delete({
      where: { id: noteId },
    });
  }

  async markAsDelivered(
    parcelId: number,
    businessId: number,
    userId: number,
  ): Promise<ParcelDto> {
    await this.validateBusinessAccess(businessId);

    const parcel = await this.prismaService.parcel.findUnique({
      where: { id: parcelId },
      select: { businessId: true },
    });

    if (!parcel || parcel.businessId !== businessId) {
      throw new NotFoundException('Parcel not found');
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { businessId: true },
    });

    if (!user || user.businessId !== businessId) {
      throw new NotFoundException('User not found');
    }

    const profile = await this.resolveUserProfile(userId);

    const updatedParcel = await this.prismaService.parcel.update({
      where: { id: parcelId },
      data: {
        deliveredByCourierId: profile.courierId,
        deliveredByDriverId: profile.driverId,
        deliveredAt: new Date(),
        deliveryStatus: DeliveryStatus.Delivered,
      },
      include: {
        sender: true,
        recipient: true,
        pickedUpByCourier: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        pickedUpByDriver: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        deliveredByCourier: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        deliveredByDriver: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return new ParcelDto(updatedParcel);
  }
}
