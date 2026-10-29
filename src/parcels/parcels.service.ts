import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { ParcelDto } from './dtos/parcel.dto';
import { ParcelNoteDto } from './dtos/parcel-note.dto';
import { Pagination } from 'src/dtos/pagination.dto';
import { UsersService } from 'src/users/users.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateParcelDto } from './dtos/create-parcel.dto';
import { UpdateParcelDto } from './dtos/update-parcel.dto';
import {
  ParcelJourneyScope,
  UpdateParcelJourneyDto,
} from './dtos/update-parcel-journey.dto';
import prismaWithPagination from 'src/prisma/prisma-client';
import { UserRequestType } from 'src/users/decorators/current-user.decorator';
import { BaseTenantService } from 'src/common/base-tenant.service';
import { TariffsService } from 'src/tariffs/tariffs.service';
import { CreateBulkParcelsDto } from './dtos/create-bulk-parcels.dto';
import { AuditService } from 'src/audit/audit.service';
import {
  AuditAction,
  DeliveryStatus,
  JourneyStatus,
  ParcelDestinationType,
  ParcelType,
  PaymentParty,
  PaymentStatus,
  PaymentReconciliationState,
  ParcelPaymentEntryKind,
  ParcelPaymentMethod,
  Prisma,
  UserType,
} from '@prisma/client';
import { ParcelDestinationDto } from './dtos/parcel-destination.dto';
import { creationFingerprint, trackingVerification } from './tracking.utils';
import { CashCollectionType } from './dtos/cash-collection.dto';
import {
  CorrectParcelStatusDto,
  ReportParcelDamageDto,
  ReverseParcelStatusDto,
  ResolveParcelDamageDto,
  TransitionParcelStatusDto,
} from './dtos/transition-parcel-status.dto';

const CUSTOMER_TYPES: UserType[] = [
  UserType.Customer,
  UserType.Member,
  UserType.Subscriber,
];

const parcelEvent = (
  parcelId: number,
  businessId: number,
  userId: number | undefined,
  action: AuditAction,
  eventType: string,
  description: string,
  details: Prisma.InputJsonObject = {},
): Prisma.AuditLogUncheckedCreateInput => ({
  userId,
  businessId,
  action,
  entityType: 'Parcel',
  entityId: String(parcelId),
  description,
  method: 'PARCEL_EVENT',
  metadata: { eventType, details },
});

const parcelDestinationInclude = {
  sender: {
    include: {
      phoneNumber: { select: { countryCode: true, number: true } },
    },
  },
  recipient: {
    include: {
      phoneNumber: { select: { countryCode: true, number: true } },
    },
  },
  originAddress: { include: { country: true } },
  shipment: {
    select: { id: true, verificationPostcodeSource: true },
  },
  destinationAddress: { include: { country: true } },
  customerNovaPostAddress: { include: { warehouse: true } },
  novaPostWarehouse: true,
  originCustomerNovaPostAddress: { include: { warehouse: true } },
  originNovaPostWarehouse: true,
  pickedUpByCourier: { include: { user: true } },
  pickedUpByDriver: { include: { user: true } },
  deliveredByCourier: { include: { user: true } },
  deliveredByDriver: { include: { user: true } },
  selectedPrice: {
    include: {
      tariff: {
        include: {
          tariffGroup: {
            include: { originCountry: true, destinationCountry: true },
          },
        },
      },
      tariffGroup: true,
    },
  },
  paymentEntries: {
    select: { kind: true, amount: true },
  },
};

interface ResolvedParcelLocation {
  type: ParcelDestinationType;
  addressId: number | null;
  customerNovaPostAddressId: number | null;
  novaPostWarehouseId: number | null;
  snapshot: Prisma.InputJsonValue;
  countryId: number;
  countryIsoCode: string;
}

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
    idempotencyKey?: string,
  ): Promise<ParcelDto> {
    const [parcel] = await this.createBulk(
      user,
      {
        senderId: body.senderId,
        recipientId: body.recipientId,
        origin: body.origin,
        destination: body.destination,
        journeyId: body.journeyId,
        parcels: [
          {
            weight: body.weight,
            parcelMoneyAmount: body.parcelMoneyAmount,
            parcelType: body.parcelType,
            initialDeliveryStatus: body.initialDeliveryStatus,
            paidBy: body.paidBy,
            tariffId: body.tariffId,
            priceOverride: body.priceOverride,
            priceOverrideReason: body.priceOverrideReason,
            paymentCollection: body.paymentCollection ?? body.cashCollection,
          },
        ],
      },
      idempotencyKey,
      creationFingerprint({ operation: 'single', body }),
    );
    return parcel;
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
    journeyId?: number,
  ): Promise<Pagination<ParcelDto> | ParcelDto[]> {
    await this.validateBusinessAccess(businessId, currentUser);

    const baseWhere = this.getBusinessWhere(businessId, {}, currentUser);
    const conditions: any[] = [];

    if (currentUser && CUSTOMER_TYPES.includes(currentUser.type)) {
      const user = await this.prismaService.user.findUnique({
        where: { id: currentUser.id },
        select: { customerProfileId: true },
      });

      if (!user?.customerProfileId) {
        if (page) {
          return {
            items: [],
            isFirstPage: true,
            isLastPage: true,
            currentPage: page,
            previousPage: null,
            nextPage: null,
            pageCount: 0,
            totalCount: 0,
          };
        }

        return [];
      }

      conditions.push({
        OR: [
          { senderId: user.customerProfileId },
          { recipientId: user.customerProfileId },
        ],
      });
    }

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
      const originCountry = await this.prismaService.country.findUnique({
        where: { id: originCountryId },
        select: { isoCode: true },
      });
      conditions.push({
        OR: [
          { originAddress: { countryId: originCountryId } },
          ...(originCountry?.isoCode === 'UA'
            ? [{ originType: ParcelDestinationType.NovaPostWarehouse }]
            : []),
        ],
      });
    }

    if (destinationCountryId) {
      const destinationCountry = await this.prismaService.country.findUnique({
        where: { id: destinationCountryId },
        select: { isoCode: true },
      });
      conditions.push({
        OR: [
          { destinationAddress: { countryId: destinationCountryId } },
          ...(destinationCountry?.isoCode === 'UA'
            ? [{ destinationType: ParcelDestinationType.NovaPostWarehouse }]
            : []),
        ],
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
            novaPostWarehouse: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { shortAddress: { contains: search, mode: 'insensitive' } },
                { cityName: { contains: search, mode: 'insensitive' } },
                {
                  warehouseNumber: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
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

    if (journeyId) {
      conditions.push({ journeyId });
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
              ...parcelDestinationInclude,
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

      const parcels = parcelsWithGroupSize.map(
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
          ...parcelDestinationInclude,
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
        sender: {
          include: {
            phoneNumber: { select: { countryCode: true, number: true } },
          },
        },
        recipient: {
          include: {
            phoneNumber: { select: { countryCode: true, number: true } },
          },
        },
        originAddress: {
          include: {
            country: true,
          },
        },
        ...parcelDestinationInclude,
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
    if (currentUser && CUSTOMER_TYPES.includes(currentUser.type)) {
      const customer = await this.prismaService.user.findUnique({
        where: { id: currentUser.id },
        select: { customerProfileId: true },
      });
      if (
        !customer?.customerProfileId ||
        (parcel.senderId !== customer.customerProfileId &&
          parcel.recipientId !== customer.customerProfileId)
      ) {
        throw new NotFoundException('Parcel not found');
      }
    }

    const groupSize = parcel.groupId
      ? await this.prismaService.parcel.count({
          where: {
            groupId: parcel.groupId,
            businessId,
            isDeleted: false,
          },
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

    const parcel = await this.prismaService.parcel.findFirst({
      where: { id, businessId, isDeleted: false },
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
        businessId,
        isDeleted: false,
        NOT: { id },
      },
      include: {
        sender: true,
        recipient: true,
        originAddress: { include: { country: true } },
        ...parcelDestinationInclude,
      },
      orderBy: { createdAt: 'asc' },
    });

    const groupSize = siblings.length + 1;
    return siblings.map((p) => new ParcelDto({ ...p, groupSize }));
  }

  async update(
    id: number,
    attrs: UpdateParcelDto,
    businessId: number,
    currentUser: UserRequestType,
  ): Promise<ParcelDto> {
    await this.validateBusinessAccess(businessId, currentUser);
    const parcel = await this.prismaService.parcel.findUnique({
      where: { id },
      include: {
        originAddress: true,
        destinationAddress: true,
        selectedPrice: {
          include: {
            tariffGroup: true,
            tariff: { include: { tariffGroup: true } },
          },
        },
      },
    });
    if (!parcel || !this.canAccessBusiness(parcel.businessId, currentUser)) {
      throw new NotFoundException('Parcel not found');
    }
    if (
      parcel.isArchived ||
      !(
        [
          DeliveryStatus.AwaitingPickup,
          DeliveryStatus.PickedUp,
          DeliveryStatus.AtOriginWarehouse,
          DeliveryStatus.InTransit,
        ] as DeliveryStatus[]
      ).includes(parcel.deliveryStatus)
    ) {
      throw new ConflictException(
        'Only initial or in-progress parcels can be edited',
      );
    }

    const {
      tariffId,
      priceOverride,
      priceOverrideReason,
      note,
      expectedUpdatedAt,
      ...parcelAttrs
    } = attrs;
    const pricingChanged =
      attrs.weight !== undefined ||
      attrs.parcelType !== undefined ||
      tariffId !== undefined ||
      priceOverride !== undefined;
    const noteContent = note?.trim();

    const updatedParcel = await this.prismaService.$transaction(async (tx) => {
      const paymentLock = `parcel-payment:${businessId}:${id}`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${paymentLock}, 0))::text`;
      const parcel = await tx.parcel.findFirst({
        where: { id, businessId, isDeleted: false },
        include: {
          originAddress: true,
          destinationAddress: true,
          selectedPrice: {
            include: {
              tariffGroup: true,
              tariff: { include: { tariffGroup: true } },
            },
          },
        },
      });
      if (!parcel) throw new NotFoundException('Parcel not found');
      if (
        parcel.isArchived ||
        !(
          [
            DeliveryStatus.AwaitingPickup,
            DeliveryStatus.PickedUp,
            DeliveryStatus.AtOriginWarehouse,
            DeliveryStatus.InTransit,
          ] as DeliveryStatus[]
        ).includes(parcel.deliveryStatus)
      ) {
        throw new ConflictException(
          'Only initial or in-progress parcels can be edited',
        );
      }
      if (
        parcel.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()
      ) {
        throw new ConflictException('Parcel changed. Reload it and try again');
      }
      const updateData: Prisma.ParcelUncheckedUpdateInput = {
        ...parcelAttrs,
      };
      let repricingDetails: Prisma.InputJsonObject | undefined;

      if (attrs.parcelType && attrs.parcelType !== ParcelType.Money) {
        updateData.parcelMoneyAmount = null;
      }

      if (pricingChanged) {
        if (
          parcel.paymentReconciliationState ===
          PaymentReconciliationState.RequiresReconciliation
        ) {
          throw new ConflictException(
            'Parcel payment balance must be reconciled before repricing',
          );
        }
        const nextWeight = attrs.weight ?? Number(parcel.weight);
        const nextParcelType = attrs.parcelType ?? parcel.parcelType;
        const nextTariffId = tariffId ?? parcel.selectedPrice?.tariffId;
        if (!nextTariffId) {
          throw new BadRequestException(
            'A tariff is required when changing parcel pricing details',
          );
        }

        let originCountryId =
          parcel.selectedPrice?.originCountryId ??
          parcel.selectedPrice?.tariffGroup?.originCountryId ??
          parcel.selectedPrice?.tariff?.tariffGroup?.originCountryId ??
          parcel.originAddress?.countryId;
        let destinationCountryId =
          parcel.selectedPrice?.destinationCountryId ??
          parcel.selectedPrice?.tariffGroup?.destinationCountryId ??
          parcel.selectedPrice?.tariff?.tariffGroup?.destinationCountryId ??
          parcel.destinationAddress?.countryId;

        if (!originCountryId || !destinationCountryId) {
          const ukraine = await tx.country.findUnique({
            where: { isoCode: 'UA' },
            select: { id: true },
          });
          if (!ukraine) {
            throw new BadRequestException(
              'Ukraine country configuration is missing',
            );
          }
          if (
            !originCountryId &&
            parcel.originType === ParcelDestinationType.NovaPostWarehouse
          ) {
            originCountryId = ukraine.id;
          }
          if (
            !destinationCountryId &&
            parcel.destinationType === ParcelDestinationType.NovaPostWarehouse
          ) {
            destinationCountryId = ukraine.id;
          }
        }
        if (!originCountryId || !destinationCountryId) {
          throw new BadRequestException('Parcel route countries are missing');
        }

        const tariff = await this.tariffsService.findEligibleTariff(
          currentUser,
          nextTariffId,
          originCountryId,
          destinationCountryId,
          nextParcelType,
          tx,
        );
        const calculatedPrice = this.tariffsService.calculateTariffAmount(
          tariff,
          nextWeight,
        );
        const tariffChanged = tariff.id !== parcel.selectedPrice?.tariffId;
        const existingOverride = parcel.selectedPrice?.isOverridden
          ? Number(parcel.price)
          : null;
        const effectiveOverride =
          priceOverride !== undefined
            ? priceOverride
            : tariffChanged
              ? null
              : existingOverride;
        if (
          priceOverride != null &&
          new Prisma.Decimal(priceOverride).decimalPlaces() > 2
        ) {
          throw new BadRequestException(
            'Manual price override must have at most 2 decimal places',
          );
        }
        const finalPrice = effectiveOverride ?? calculatedPrice;
        const isPriceOverridden =
          effectiveOverride != null && effectiveOverride !== calculatedPrice;

        if (tariff.business.currency !== parcel.paymentCurrency) {
          throw new ConflictException(
            'Repricing cannot change the parcel payment currency',
          );
        }
        const paymentEntries = await tx.parcelPaymentEntry.findMany({
          where: { parcelId: parcel.id },
          select: { kind: true, amount: true },
        });
        const collected = paymentEntries.reduce(
          (total, entry) =>
            entry.kind === ParcelPaymentEntryKind.Reversal
              ? total.minus(entry.amount)
              : total.plus(entry.amount),
          new Prisma.Decimal(0),
        );
        if (new Prisma.Decimal(finalPrice).lessThan(collected)) {
          throw new ConflictException(
            'Parcel price cannot be reduced below collected money',
          );
        }
        const automaticTariffReset =
          tariffChanged && priceOverride === null && existingOverride != null;
        if (
          priceOverride !== undefined &&
          !automaticTariffReset &&
          !priceOverrideReason?.trim()
        ) {
          throw new BadRequestException(
            'A reason is required when changing a manual price override',
          );
        }

        if (parcel.selectedPriceId) {
          await tx.parcelPrice.update({
            where: { id: parcel.selectedPriceId },
            data: { isSelected: false },
          });
        }

        const selectedPrice = await tx.parcelPrice.create({
          data: {
            parcelId: parcel.id,
            tariffId: tariff.id,
            tariffGroupId: tariff.tariffGroup!.id,
            label: tariff.name,
            currency: tariff.business.currency,
            baseAmount: calculatedPrice,
            finalAmount: finalPrice,
            isSelected: true,
            isOverridden: isPriceOverridden,
            parcelType: nextParcelType,
            weight: nextWeight,
            tariffName: tariff.name,
            tariffGroupName: tariff.tariffGroup!.name,
            pricingType: tariff.pricingType,
            fixedPrice:
              tariff.pricingType === 'Fixed' ? tariff.minimumPrice : null,
            minimumPrice: tariff.minimumPrice,
            pricePerKg: tariff.pricePerKg,
            weightThreshold: tariff.weightThreshold,
            originCountryId,
            destinationCountryId,
            changeReason:
              priceOverride != null
                ? priceOverrideReason!.trim()
                : tariffChanged || priceOverride === null
                  ? null
                  : parcel.selectedPrice?.changeReason,
            changedByUserId:
              priceOverride != null
                ? currentUser.id
                : tariffChanged || priceOverride === null
                  ? null
                  : parcel.selectedPrice?.changedByUserId,
          },
        });

        const changeTypes: string[] = [];
        if (tariffChanged) changeTypes.push('Tariff');
        if (attrs.weight !== undefined) changeTypes.push('Weight');
        if (attrs.parcelType !== undefined) changeTypes.push('ParcelType');
        if (priceOverride != null) changeTypes.push('ManualOverride');
        if (
          priceOverride === null &&
          existingOverride != null &&
          !tariffChanged
        ) {
          changeTypes.push('OverrideRemoved');
        }
        repricingDetails = {
          changeTypes,
          currency: tariff.business.currency,
          previousPrice: String(parcel.price),
          price: String(finalPrice),
          previousCalculatedPrice: String(
            parcel.selectedPrice?.baseAmount ?? parcel.calculatedPrice,
          ),
          calculatedPrice: String(calculatedPrice),
          previousPricingMode: parcel.selectedPrice?.isOverridden
            ? 'Manual'
            : 'Tariff',
          pricingMode: isPriceOverridden ? 'Manual' : 'Tariff',
          previousTariffId: parcel.selectedPrice?.tariffId ?? 0,
          tariffId: tariff.id,
          previousTariffName:
            parcel.selectedPrice?.tariffName ??
            parcel.selectedPrice?.label ??
            'Невідомий тариф',
          tariffName: tariff.name,
          previousWeight: String(parcel.weight),
          weight: String(nextWeight),
          previousParcelType: parcel.parcelType,
          parcelType: nextParcelType,
          reason: priceOverrideReason?.trim() ?? '',
        };

        Object.assign(updateData, {
          weight: nextWeight,
          parcelType: nextParcelType,
          price: finalPrice,
          calculatedPrice,
          isPriceOverridden,
          selectedPriceId: selectedPrice.id,
          paymentStatus:
            Number(finalPrice) === 0
              ? PaymentStatus.Paid
              : collected.equals(0)
                ? PaymentStatus.NotPaid
                : collected.equals(new Prisma.Decimal(finalPrice))
                  ? PaymentStatus.Paid
                  : PaymentStatus.PartiallyPaid,
        });
      }

      if (noteContent) {
        await tx.parcelNote.create({
          data: {
            content: noteContent,
            parcelId: parcel.id,
            userId: Number(currentUser.id),
          },
        });
      }

      const result = await tx.parcel.update({
        where: { id },
        data: updateData,
        include: {
          sender: true,
          recipient: true,
          originAddress: { include: { country: true } },
          ...parcelDestinationInclude,
          pickedUpByCourier: { include: { user: true } },
          pickedUpByDriver: { include: { user: true } },
          deliveredByCourier: { include: { user: true } },
          deliveredByDriver: { include: { user: true } },
          business: currentUser.isSuperAdmin,
        },
      });
      await tx.auditLog.create({
        data: parcelEvent(
          id,
          businessId,
          currentUser.id,
          AuditAction.UPDATE,
          pricingChanged ? 'ParcelRepriced' : 'ParcelUpdated',
          `Updated parcel ${parcel.trackingNumber}`,
          pricingChanged
            ? repricingDetails!
            : {
                changedFields: Object.keys(attrs).filter(
                  (key) => key !== 'note' && key !== 'expectedUpdatedAt',
                ),
              },
        ),
      });
      if (noteContent) {
        await tx.auditLog.create({
          data: parcelEvent(
            id,
            businessId,
            currentUser.id,
            AuditAction.CREATE,
            'NoteAdded',
            'Added parcel note',
          ),
        });
      }
      return result;
    });

    await this.auditService.log({
      userId: Number(currentUser.id),
      action: AuditAction.UPDATE,
      entityType: 'Parcel',
      description: `Updated parcel ${parcel.trackingNumber}`,
      metadata: {
        parcelId: parcel.id,
        changedFields: Object.keys(attrs).filter((key) => key !== 'note'),
        noteAdded: Boolean(noteContent),
      },
      businessId,
    });

    const groupSize = updatedParcel.groupId
      ? await this.prismaService.parcel.count({
          where: {
            groupId: updatedParcel.groupId,
            businessId,
            isDeleted: false,
          },
        })
      : 1;

    return new ParcelDto({ ...updatedParcel, groupSize });
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

    const paymentEntryCount = await this.prismaService.parcelPaymentEntry.count(
      {
        where: { parcelId: id, businessId: parcel.businessId },
      },
    );
    await this.prismaService.$transaction(async (tx) => {
      if (paymentEntryCount > 0) {
        await tx.parcel.update({
          where: { id },
          data: { isDeleted: true, isArchived: true },
        });
        await tx.auditLog.create({
          data: parcelEvent(
            id,
            parcel.businessId,
            currentUser?.id,
            AuditAction.ARCHIVE,
            'ParcelArchived',
            'Archived parcel with financial history',
          ),
        });
        return;
      }
      await tx.auditLog.create({
        data: parcelEvent(
          id,
          parcel.businessId,
          currentUser?.id,
          AuditAction.DELETE,
          'ParcelDeleted',
          'Deleted parcel',
        ),
      });
      await tx.parcel.delete({ where: { id } });
    });
  }

  async updateJourneyAssignment(
    parcelId: number,
    body: UpdateParcelJourneyDto,
    currentUser: UserRequestType,
  ): Promise<ParcelDto[]> {
    const businessId = currentUser.businessId;
    await this.validateBusinessAccess(businessId, currentUser);

    const allowedManager =
      currentUser.isAdmin ||
      currentUser.isSuperAdmin ||
      currentUser.type === UserType.Manager ||
      currentUser.type === UserType.Moderator;
    const isDriver = currentUser.type === UserType.InternationalDriver;
    if (!allowedManager && !isDriver) {
      throw new ForbiddenException('User cannot manage parcel journeys');
    }

    const result = await this.prismaService.$transaction(
      async (tx) => {
        const selectedParcel = await tx.parcel.findFirst({
          where: { id: parcelId, businessId, isDeleted: false },
          select: { id: true, groupId: true },
        });
        if (!selectedParcel) {
          throw new NotFoundException('Parcel not found');
        }

        const where =
          body.scope === ParcelJourneyScope.Group && selectedParcel.groupId
            ? { businessId, groupId: selectedParcel.groupId, isDeleted: false }
            : { businessId, id: selectedParcel.id, isDeleted: false };
        const affected = await tx.parcel.findMany({
          where,
          include: {
            originAddress: { select: { countryId: true } },
            destinationAddress: { select: { countryId: true } },
            selectedPrice: {
              select: { originCountryId: true, destinationCountryId: true },
            },
          },
          orderBy: { id: 'asc' },
        });

        const terminalStatuses: DeliveryStatus[] = [
          DeliveryStatus.Delivered,
          DeliveryStatus.Cancelled,
          DeliveryStatus.Returned,
          DeliveryStatus.Lost,
        ];
        if (
          affected.some(
            (parcel) =>
              parcel.isArchived ||
              terminalStatuses.includes(parcel.deliveryStatus),
          )
        ) {
          throw new ConflictException(
            'Archived or terminal parcels cannot change journeys',
          );
        }
        const assignableStatuses: DeliveryStatus[] = [
          DeliveryStatus.AwaitingPickup,
          DeliveryStatus.PickedUp,
          DeliveryStatus.AtOriginWarehouse,
        ];
        if (
          affected.some(
            (parcel) => !assignableStatuses.includes(parcel.deliveryStatus),
          )
        ) {
          throw new ConflictException(
            'Only parcels awaiting pickup, picked up, or at the origin warehouse can change journeys',
          );
        }

        const driverProfile = isDriver
          ? await tx.driverProfile.findFirst({
              where: {
                userId: currentUser.id,
                isDeleted: false,
                user: { businessId },
              },
              select: { id: true },
            })
          : null;
        if (isDriver && !driverProfile) {
          throw new NotFoundException('User has no active driver profile');
        }

        if (isDriver) {
          const currentJourneyIds = [
            ...new Set(
              affected
                .map((parcel) => parcel.journeyId)
                .filter((id): id is number => id != null),
            ),
          ];
          if (currentJourneyIds.length > 0) {
            const ownCurrentJourneyCount = await tx.journey.count({
              where: {
                id: { in: currentJourneyIds },
                businessId,
                driverProfiles: { some: { id: driverProfile!.id } },
              },
            });
            if (ownCurrentJourneyCount !== currentJourneyIds.length) {
              throw new ForbiddenException(
                'Drivers can only remove parcels from their own journeys',
              );
            }
          }
        }

        let targetJourneyStatus: JourneyStatus | null = null;
        if (body.journeyId != null) {
          const journey = await tx.journey.findFirst({
            where: {
              id: body.journeyId,
              businessId,
              isCompleted: false,
              status: {
                in: [JourneyStatus.Scheduled, JourneyStatus.InTransit],
              },
              isArchived: false,
              isDeleted: false,
            },
            select: {
              status: true,
              startCountryId: true,
              endCountryId: true,
              driverProfiles: { select: { id: true } },
            },
          });
          if (!journey) {
            throw new NotFoundException('Active journey not found');
          }
          if (
            isDriver &&
            !journey.driverProfiles.some(({ id }) => id === driverProfile!.id)
          ) {
            throw new ForbiddenException(
              'Drivers can only assign parcels to their own journeys',
            );
          }

          const ukraine = await tx.country.findUnique({
            where: { isoCode: 'UA' },
            select: { id: true },
          });
          const routeMismatch = affected.some((parcel) => {
            const originCountryId =
              parcel.selectedPrice?.originCountryId ??
              parcel.originAddress?.countryId ??
              (parcel.originType === ParcelDestinationType.NovaPostWarehouse
                ? ukraine?.id
                : undefined);
            const destinationCountryId =
              parcel.selectedPrice?.destinationCountryId ??
              parcel.destinationAddress?.countryId ??
              (parcel.destinationType ===
              ParcelDestinationType.NovaPostWarehouse
                ? ukraine?.id
                : undefined);
            return (
              originCountryId !== journey.startCountryId ||
              destinationCountryId !== journey.endCountryId
            );
          });
          if (routeMismatch) {
            throw new BadRequestException(
              'Parcel route does not match the selected journey',
            );
          }
          if (
            journey.status === JourneyStatus.InTransit &&
            affected.some(
              (parcel) =>
                parcel.deliveryStatus === DeliveryStatus.AwaitingPickup,
            )
          ) {
            throw new ConflictException(
              'A parcel awaiting pickup cannot be added to an in-transit journey',
            );
          }
          targetJourneyStatus = journey.status;
        }

        const previousJourneyIds = Object.fromEntries(
          affected.map((parcel) => [parcel.id, parcel.journeyId]),
        );
        const joinsInTransitJourney =
          targetJourneyStatus === JourneyStatus.InTransit;
        const statusBatchId = joinsInTransitJourney ? randomUUID() : null;
        await tx.parcel.updateMany({
          where,
          data:
            body.journeyId == null
              ? {
                  journeyId: null,
                }
              : {
                  journeyId: body.journeyId,
                  ...(joinsInTransitJourney && {
                    deliveryStatus: DeliveryStatus.InTransit,
                  }),
                },
        });

        if (joinsInTransitJourney && statusBatchId) {
          await tx.parcelStatusTransition.createMany({
            data: affected.map((parcel) => ({
              parcelId: parcel.id,
              businessId,
              journeyId: body.journeyId,
              batchId: statusBatchId,
              fromStatus: parcel.deliveryStatus,
              toStatus: DeliveryStatus.InTransit,
              actorId: currentUser.id,
            })),
          });
        }

        await tx.auditLog.createMany({
          data: affected.map((parcel) =>
            parcelEvent(
              parcel.id,
              businessId,
              currentUser.id,
              body.journeyId == null
                ? AuditAction.UNASSIGN
                : AuditAction.ASSIGN,
              body.journeyId == null ? 'JourneyUnassigned' : 'JourneyAssigned',
              'Updated parcel journey assignment',
              {
                scope: body.scope,
                previousJourneyId: previousJourneyIds[parcel.id],
                journeyId: body.journeyId,
                ...(joinsInTransitJourney && {
                  fromStatus: parcel.deliveryStatus,
                  toStatus: DeliveryStatus.InTransit,
                  batchId: statusBatchId,
                }),
              },
            ),
          ),
        });
        return tx.parcel.findMany({
          where,
          include: {
            sender: true,
            recipient: true,
            originAddress: { include: { country: true } },
            ...parcelDestinationInclude,
            pickedUpByCourier: { include: { user: true } },
            pickedUpByDriver: { include: { user: true } },
            deliveredByCourier: { include: { user: true } },
            deliveredByDriver: { include: { user: true } },
          },
          orderBy: { id: 'asc' },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const groupSizes = await this.attachGroupSize(result);
    return groupSizes.map((parcel) => new ParcelDto(parcel));
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
        ...parcelDestinationInclude,
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
          ...parcelDestinationInclude,
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
    idempotencyKey?: string,
    fingerprint = creationFingerprint({ operation: 'bulk', body }),
  ): Promise<ParcelDto[]> {
    await this.validateBusinessAccess(user.businessId, user);

    if (
      idempotencyKey !== undefined &&
      !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)
    ) {
      throw new BadRequestException('Invalid Idempotency-Key');
    }

    const { senderId, recipientId, origin, destination, journeyId, parcels } =
      body;
    const shipmentId = randomUUID();
    const groupId = parcels.length > 1 ? shipmentId : null;
    const result = await this.prismaService.$transaction(
      async (tx) => {
        if (idempotencyKey) {
          const lockKey = `parcel-create:${user.businessId}:${user.id}:${idempotencyKey}`;
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text`;
          const previous = await tx.parcelCreationRequest.findUnique({
            where: {
              businessId_userId_key: {
                businessId: user.businessId,
                userId: user.id,
                key: idempotencyKey,
              },
            },
          });
          if (previous) {
            if (previous.fingerprint !== fingerprint) {
              throw new ConflictException(
                'Idempotency-Key was already used with a different payload',
              );
            }
            const original = await tx.parcel.findMany({
              where: {
                id: { in: previous.parcelIds },
                businessId: user.businessId,
              },
              include: {
                sender: true,
                recipient: true,
                originAddress: { include: { country: true } },
                ...parcelDestinationInclude,
              },
            });
            const byId = new Map(original.map((parcel) => [parcel.id, parcel]));
            return {
              created: false,
              parcels: previous.parcelIds.map(
                (id) =>
                  new ParcelDto({
                    ...byId.get(id),
                    groupSize: original.length,
                  }),
              ),
            };
          }
        }
        const pickupProfile =
          user.type === UserType.InternationalDriver ||
          user.type === UserType.ParcelCourier
            ? await this.resolveUserProfile(user.id, user.businessId, tx)
            : {};
        const createdParcels = [];
        const contacts = await this.validateParcelProfiles(
          tx,
          user.businessId,
          senderId,
          recipientId,
        );
        const originLocation = await this.resolveParcelLocation(
          tx,
          origin,
          senderId,
          user.businessId,
          contacts.senderPhoneNumber,
          'Origin',
        );
        const destinationLocation = await this.resolveParcelLocation(
          tx,
          destination,
          recipientId,
          user.businessId,
          contacts.recipientPhoneNumber,
          'Destination',
        );
        await tx.shipment.create({
          data: {
            id: shipmentId,
            businessId: user.businessId,
            ...trackingVerification(
              destinationLocation.snapshot,
              originLocation.snapshot,
            ),
          },
        });
        let selectedJourneyStatus: JourneyStatus | null = null;
        if (journeyId) {
          const journey = await tx.journey.findFirst({
            where: {
              id: journeyId,
              businessId: user.businessId,
              isDeleted: false,
            },
            select: {
              status: true,
              isCompleted: true,
              isArchived: true,
              startCountryId: true,
              endCountryId: true,
              driverProfiles: { select: { id: true } },
            },
          });

          if (!journey) {
            throw new NotFoundException('Journey not found');
          }
          if (
            !(
              [
                JourneyStatus.Scheduled,
                JourneyStatus.InTransit,
              ] as JourneyStatus[]
            ).includes(journey.status) ||
            journey.isCompleted ||
            journey.isArchived
          ) {
            throw new ConflictException(
              'Parcels cannot be added to an inactive journey',
            );
          }
          if (
            journey.startCountryId !== originLocation.countryId ||
            journey.endCountryId !== destinationLocation.countryId
          ) {
            throw new BadRequestException(
              'Parcel route does not match the selected journey',
            );
          }
          if (
            pickupProfile.driverId &&
            !journey.driverProfiles.some(
              (driver) => driver.id === pickupProfile.driverId,
            )
          ) {
            throw new ForbiddenException(
              'Drivers can only add parcels to their own journeys',
            );
          }
          if (
            journey.status === JourneyStatus.InTransit &&
            pickupProfile.courierId
          ) {
            throw new ForbiddenException(
              'Couriers cannot add parcels to an in-transit journey',
            );
          }
          selectedJourneyStatus = journey.status;
        }

        for (const parcelItem of parcels) {
          const requestedInitialDeliveryStatus =
            parcelItem.initialDeliveryStatus ??
            DeliveryStatus.AtOriginWarehouse;
          if (
            !(
              [
                DeliveryStatus.AwaitingPickup,
                DeliveryStatus.PickedUp,
                DeliveryStatus.AtOriginWarehouse,
              ] as DeliveryStatus[]
            ).includes(requestedInitialDeliveryStatus)
          ) {
            throw new BadRequestException(
              'Invalid initial parcel delivery status',
            );
          }
          if (
            requestedInitialDeliveryStatus === DeliveryStatus.PickedUp &&
            !pickupProfile.driverId &&
            !pickupProfile.courierId
          ) {
            throw new ForbiddenException(
              'Only drivers and couriers can create a parcel as picked up',
            );
          }
          const initialDeliveryStatus =
            selectedJourneyStatus === JourneyStatus.InTransit
              ? DeliveryStatus.InTransit
              : requestedInitialDeliveryStatus;
          if (parcelItem.paymentCollection && parcelItem.cashCollection) {
            throw new BadRequestException(
              'Use paymentCollection or cashCollection, not both',
            );
          }
          const paymentCollection =
            parcelItem.paymentCollection ?? parcelItem.cashCollection;
          const tariff = await this.tariffsService.findEligibleTariff(
            user,
            parcelItem.tariffId,
            originLocation.countryId,
            destinationLocation.countryId,
            parcelItem.parcelType,
            tx,
          );
          const calculatedPrice = this.tariffsService.calculateTariffAmount(
            tariff,
            parcelItem.weight,
          );
          const isPriceOverridden =
            parcelItem.priceOverride != null &&
            parcelItem.priceOverride !== calculatedPrice;
          const finalPrice = parcelItem.priceOverride ?? calculatedPrice;
          if (
            parcelItem.priceOverride != null &&
            new Prisma.Decimal(parcelItem.priceOverride).decimalPlaces() > 2
          ) {
            throw new BadRequestException(
              'Manual price override must have at most 2 decimal places',
            );
          }
          if (
            parcelItem.priceOverride != null &&
            !parcelItem.priceOverrideReason?.trim()
          ) {
            throw new BadRequestException(
              'A reason is required for a manual price override',
            );
          }
          const finalAmount = new Prisma.Decimal(finalPrice).toDecimalPlaces(
            2,
            Prisma.Decimal.ROUND_HALF_UP,
          );
          let collectionAmount: Prisma.Decimal | null = null;
          if (paymentCollection) {
            if (finalAmount.equals(0)) {
              throw new BadRequestException(
                'Payment is not required for a zero-charge parcel',
              );
            }
            if (paymentCollection.type === CashCollectionType.Full) {
              if (paymentCollection.amount !== undefined) {
                throw new BadRequestException(
                  'Full collection amount is server calculated',
                );
              }
              collectionAmount = finalAmount;
            } else {
              collectionAmount = new Prisma.Decimal(paymentCollection.amount!);
              if (
                collectionAmount.lessThanOrEqualTo(0) ||
                collectionAmount.decimalPlaces() > 2 ||
                collectionAmount.greaterThanOrEqualTo(finalAmount)
              ) {
                throw new BadRequestException(
                  'Partial collection must be positive and below the parcel charge',
                );
              }
            }
          }
          const initialPaymentStatus = finalAmount.equals(0)
            ? PaymentStatus.Paid
            : collectionAmount == null
              ? PaymentStatus.NotPaid
              : collectionAmount.equals(finalAmount)
                ? PaymentStatus.Paid
                : PaymentStatus.PartiallyPaid;
          const createdAt = new Date();
          const trackingNumber = await this.generateTrackingNumber(
            tx,
            user.businessId,
            destinationLocation.countryIsoCode,
            createdAt,
          );

          const parcel = await tx.parcel.create({
            data: {
              weight: parcelItem.weight,
              price: finalPrice,
              calculatedPrice,
              isPriceOverridden,
              parcelType: parcelItem.parcelType,
              paymentStatus: initialPaymentStatus,
              paymentCurrency: tariff.business.currency,
              paymentReconciliationState: PaymentReconciliationState.Reconciled,
              paidBy: parcelItem.paidBy ?? PaymentParty.Sender,
              parcelMoneyAmount: parcelItem.parcelMoneyAmount,
              hasBorderCheck: parcelItem.hasBorderCheck,
              senderId,
              recipientId,
              senderPhoneNumber: contacts.senderPhoneNumber,
              recipientPhoneNumber: contacts.recipientPhoneNumber,
              ...this.toOriginData(originLocation),
              ...this.toDestinationData(destinationLocation),
              journeyId,
              pickedUpByDriverId:
                initialDeliveryStatus === DeliveryStatus.PickedUp
                  ? pickupProfile.driverId
                  : undefined,
              pickedUpByCourierId:
                initialDeliveryStatus === DeliveryStatus.PickedUp
                  ? pickupProfile.courierId
                  : undefined,
              pickedUpAt:
                initialDeliveryStatus === DeliveryStatus.PickedUp
                  ? new Date()
                  : undefined,
              deliveryStatus: initialDeliveryStatus,
              businessId: user.businessId,
              trackingNumber,
              createdAt,
              groupId,
              shipmentId,
            },
          });
          const selectedPrice = await tx.parcelPrice.create({
            data: {
              parcelId: parcel.id,
              tariffId: tariff.id,
              tariffGroupId: tariff.tariffGroup!.id,
              label: tariff.name,
              currency: tariff.business.currency,
              baseAmount: calculatedPrice,
              finalAmount: finalPrice,
              isSelected: true,
              isOverridden: isPriceOverridden,
              parcelType: parcelItem.parcelType,
              weight: parcelItem.weight,
              tariffName: tariff.name,
              tariffGroupName: tariff.tariffGroup!.name,
              pricingType: tariff.pricingType,
              fixedPrice:
                tariff.pricingType === 'Fixed' ? tariff.minimumPrice : null,
              minimumPrice: tariff.minimumPrice,
              pricePerKg: tariff.pricePerKg,
              weightThreshold: tariff.weightThreshold,
              originCountryId: originLocation.countryId,
              destinationCountryId: destinationLocation.countryId,
              changeReason: parcelItem.priceOverrideReason?.trim() || null,
              changedByUserId:
                parcelItem.priceOverride != null ? user.id : null,
            },
          });
          let pricedParcel = await tx.parcel.update({
            where: { id: parcel.id },
            data: { selectedPriceId: selectedPrice.id },
            include: {
              sender: true,
              recipient: true,
              originAddress: {
                include: {
                  country: true,
                },
              },
              ...parcelDestinationInclude,
            },
          });

          if (collectionAmount && paymentCollection) {
            const entry = await tx.parcelPaymentEntry.create({
              data: {
                businessId: user.businessId,
                parcelId: parcel.id,
                parcelPriceId: selectedPrice.id,
                kind: ParcelPaymentEntryKind.Collection,
                amount: collectionAmount,
                currency: tariff.business.currency,
                method: paymentCollection.method ?? ParcelPaymentMethod.Cash,
                payerParty: paymentCollection.payerParty,
                collectorId: user.id,
                recordedById: user.id,
                note: paymentCollection.note?.trim() || null,
              },
            });
            await tx.auditLog.create({
              data: {
                userId: user.id,
                businessId: user.businessId,
                action: AuditAction.CREATE,
                entityType: 'ParcelPaymentEntry',
                entityId: String(entry.id),
                description: 'Recorded payment during parcel creation',
                metadata: {
                  parcelId: parcel.id,
                  amount: collectionAmount.toFixed(2),
                  currency: tariff.business.currency,
                  method: paymentCollection.method ?? ParcelPaymentMethod.Cash,
                },
              },
            });
            await tx.auditLog.create({
              data: parcelEvent(
                parcel.id,
                user.businessId,
                user.id,
                AuditAction.CREATE,
                'PaymentCollected',
                'Recorded payment during parcel creation',
                {
                  amount: collectionAmount.toFixed(2),
                  currency: tariff.business.currency,
                  method: paymentCollection.method ?? ParcelPaymentMethod.Cash,
                  payerParty: paymentCollection.payerParty,
                },
              ),
            });
            pricedParcel = await tx.parcel.findUniqueOrThrow({
              where: { id: parcel.id },
              include: {
                sender: true,
                recipient: true,
                originAddress: { include: { country: true } },
                ...parcelDestinationInclude,
              },
            });
          }

          await tx.auditLog.create({
            data: parcelEvent(
              parcel.id,
              user.businessId,
              user.id,
              AuditAction.CREATE,
              'ParcelCreated',
              `Created parcel ${parcel.trackingNumber}`,
              {
                trackingNumber: parcel.trackingNumber,
                journeyId,
                deliveryStatus: initialDeliveryStatus,
              },
            ),
          });

          if (selectedJourneyStatus === JourneyStatus.InTransit) {
            await tx.auditLog.create({
              data: parcelEvent(
                parcel.id,
                user.businessId,
                user.id,
                AuditAction.ASSIGN,
                'ParcelInTransit',
                'Created parcel on an in-transit journey',
                {
                  journeyId,
                  toStatus: DeliveryStatus.InTransit,
                  addedDuringActiveJourney: true,
                },
              ),
            });
          }

          createdParcels.push(pricedParcel);
        }

        if (idempotencyKey) {
          await tx.parcelCreationRequest.create({
            data: {
              businessId: user.businessId,
              userId: user.id,
              key: idempotencyKey,
              fingerprint,
              parcelIds: createdParcels.map((parcel) => parcel.id),
            },
          });
        }

        return {
          created: true,
          parcels: createdParcels.map(
            (parcel) =>
              new ParcelDto({ ...parcel, groupSize: createdParcels.length }),
          ),
        };
      },
      {
        maxWait: 10000,
        timeout: 30000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
    if (result.created) {
      await this.auditService.log({
        userId: user.id,
        businessId: user.businessId,
        action: AuditAction.CREATE,
        entityType: 'Parcel',
        description: `Bulk created ${result.parcels.length} parcels`,
        metadata: {
          parcelCount: result.parcels.length,
          parcelIds: result.parcels.map((parcel) => parcel.id),
          trackingNumbers: result.parcels.map(
            (parcel) => parcel.trackingNumber,
          ),
          senderId,
          recipientId,
          groupId,
          shipmentId,
          journeyId,
          pickedUpByDriverId: result.parcels[0]?.pickedUpByDriverId,
          pickedUpAt: result.parcels[0]?.pickedUpAt,
        },
      });
    }
    return result.parcels;
  }

  private async validateParcelProfiles(
    tx: Prisma.TransactionClient,
    businessId: number,
    senderId: number,
    recipientId: number,
  ): Promise<{
    senderPhoneNumber: string;
    recipientPhoneNumber: string;
  }> {
    const profiles = await tx.customerProfile.findMany({
      where: {
        id: { in: [senderId, recipientId] },
        businessId,
        isDeleted: false,
        isActive: true,
      },
      select: {
        id: true,
        phoneNumber: { select: { countryCode: true, number: true } },
      },
    });
    const expectedProfiles = senderId === recipientId ? 1 : 2;
    if (profiles.length !== expectedProfiles) {
      throw new BadRequestException(
        'Sender and recipient must be active customers in this business',
      );
    }
    const phoneFor = (profileId: number) => {
      const phone = profiles.find(
        (profile) => profile.id === profileId,
      )?.phoneNumber;
      if (!phone) {
        throw new BadRequestException(
          'Parcel customer phone number is missing',
        );
      }
      return `${phone.countryCode}${phone.number}`;
    };
    return {
      senderPhoneNumber: phoneFor(senderId),
      recipientPhoneNumber: phoneFor(recipientId),
    };
  }

  private async resolveParcelLocation(
    tx: Prisma.TransactionClient,
    location: ParcelDestinationDto,
    customerId: number,
    businessId: number,
    phoneNumber: string | null | undefined,
    role: 'Origin' | 'Destination',
  ): Promise<ResolvedParcelLocation> {
    if (location.type === ParcelDestinationType.CustomerAddress) {
      if (
        location.warehouseId != null ||
        location.customerNovaPostAddressId != null ||
        location.saveToCustomerProfile === true
      ) {
        throw new BadRequestException(
          'CustomerAddress locations cannot contain Nova Post fields',
        );
      }
      if (location.addressId == null) {
        throw new BadRequestException('addressId is required');
      }
      const address = await tx.address.findFirst({
        where: {
          id: location.addressId,
          profileId: customerId,
          businessId,
          isActive: true,
          isDeleted: false,
        },
        include: { country: true },
      });
      if (!address) {
        throw new BadRequestException(
          `${role} address must be active and belong to the selected customer`,
        );
      }
      return {
        type: ParcelDestinationType.CustomerAddress,
        addressId: address.id,
        customerNovaPostAddressId: null,
        novaPostWarehouseId: null,
        countryId: address.countryId,
        countryIsoCode: address.country.isoCode,
        snapshot: {
          type: 'CustomerAddress',
          addressId: address.id,
          line1: address.line1,
          line2: address.line2,
          line3: address.line3,
          street: address.street,
          city: address.city,
          village: address.village,
          postcode: address.postcode,
          region: address.region,
          county: address.county,
          block: address.block,
          building: address.building,
          flat: address.flat,
          note: address.note,
          countryIsoCode: address.country.isoCode,
          uprn: address.uprn,
          latitude: address.latitude?.toString() ?? null,
          longitude: address.longitude?.toString() ?? null,
          provider: address.provider,
          providerRef: address.providerRef,
        } as Prisma.InputJsonValue,
      };
    }

    if (location.type !== ParcelDestinationType.NovaPostWarehouse) {
      throw new BadRequestException('Unsupported parcel location type');
    }
    if (location.addressId != null) {
      throw new BadRequestException(
        'NovaPostWarehouse locations cannot contain addressId',
      );
    }
    if (location.warehouseId == null) {
      throw new BadRequestException('warehouseId is required');
    }
    if (
      location.saveToCustomerProfile === true &&
      location.customerNovaPostAddressId != null
    ) {
      throw new BadRequestException(
        'Do not combine customerNovaPostAddressId with saveToCustomerProfile',
      );
    }

    const [warehouse, customer, ukraine] = await Promise.all([
      tx.novaPostWarehouse.findFirst({
        where: { id: location.warehouseId, isActive: true },
      }),
      tx.customerProfile.findFirst({
        where: {
          id: customerId,
          businessId,
          isDeleted: false,
          isActive: true,
        },
        select: { firstName: true, lastName: true },
      }),
      tx.country.findUnique({ where: { isoCode: 'UA' }, select: { id: true } }),
    ]);
    if (!warehouse) {
      throw new BadRequestException(
        'Nova Post warehouse is inactive or invalid',
      );
    }
    if (!customer) {
      throw new BadRequestException('Parcel customer is invalid');
    }
    if (!ukraine) {
      throw new BadRequestException('Ukraine country configuration is missing');
    }

    let savedAddress = location.customerNovaPostAddressId
      ? await tx.customerNovaPostAddress.findFirst({
          where: {
            id: location.customerNovaPostAddressId,
            customerProfileId: customerId,
            warehouseId: warehouse.id,
            customerProfile: { businessId },
          },
        })
      : null;
    if (location.customerNovaPostAddressId && !savedAddress) {
      throw new BadRequestException(
        'Saved Nova Post address must belong to the selected customer and warehouse',
      );
    }

    if (location.saveToCustomerProfile) {
      const savedCount = await tx.customerNovaPostAddress.count({
        where: { customerProfileId: customerId },
      });
      savedAddress = await tx.customerNovaPostAddress.upsert({
        where: {
          customerProfileId_warehouseId: {
            customerProfileId: customerId,
            warehouseId: warehouse.id,
          },
        },
        create: {
          customerProfileId: customerId,
          warehouseId: warehouse.id,
          isDefault: savedCount === 0,
        },
        update: {},
      });
    }

    const profileName = [customer.firstName, customer.lastName]
      .filter(Boolean)
      .join(' ');
    return {
      type: ParcelDestinationType.NovaPostWarehouse,
      addressId: null,
      customerNovaPostAddressId: savedAddress?.id ?? null,
      novaPostWarehouseId: warehouse.id,
      countryId: ukraine.id,
      countryIsoCode: 'UA',
      snapshot: {
        type: 'NovaPostWarehouse',
        warehouseRef: warehouse.externalRef,
        warehouseNumber: warehouse.warehouseNumber,
        warehouseName: warehouse.name,
        cityName: warehouse.cityName,
        shortAddress: warehouse.shortAddress,
        contactName: savedAddress?.recipientName ?? profileName,
        contactPhone: savedAddress?.recipientPhone ?? phoneNumber ?? null,
      } as Prisma.InputJsonValue,
    };
  }

  private toOriginData(location: ResolvedParcelLocation) {
    return {
      originType: location.type,
      originAddressId: location.addressId,
      originCustomerNovaPostAddressId: location.customerNovaPostAddressId,
      originNovaPostWarehouseId: location.novaPostWarehouseId,
      originSnapshot: location.snapshot,
    };
  }

  private toDestinationData(location: ResolvedParcelLocation) {
    return {
      destinationType: location.type,
      destinationAddressId: location.addressId,
      customerNovaPostAddressId: location.customerNovaPostAddressId,
      novaPostWarehouseId: location.novaPostWarehouseId,
      destinationSnapshot: location.snapshot,
    };
  }

  private async attachGroupSize<
    T extends { groupId?: string | null; id: number; businessId: number },
  >(parcels: T[]): Promise<(T & { groupSize: number })[]> {
    const groupIds = [
      ...new Set(parcels.map((p) => p.groupId).filter(Boolean)),
    ] as string[];

    if (groupIds.length === 0) {
      return parcels.map((p) => ({ ...p, groupSize: 1 }));
    }

    const counts = await this.prismaService.parcel.groupBy({
      by: ['businessId', 'groupId'],
      where: {
        groupId: { in: groupIds },
        businessId: {
          in: [...new Set(parcels.map((parcel) => parcel.businessId))],
        },
        isDeleted: false,
      },
      _count: { id: true },
    });

    const countMap = new Map(
      counts.map((c) => [`${c.businessId}:${c.groupId}`, c._count.id]),
    );

    return parcels.map((p) => ({
      ...p,
      groupSize: p.groupId
        ? (countMap.get(`${p.businessId}:${p.groupId}`) ?? 1)
        : 1,
    }));
  }

  private async generateTrackingNumber(
    tx: Prisma.TransactionClient,
    businessId: number,
    destinationIsoCode: string,
    createdAt: Date,
  ) {
    const destination = destinationIsoCode.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(destination)) {
      throw new BadRequestException(
        'Destination country must have a two-letter ISO code',
      );
    }

    const year = createdAt.getUTCFullYear();
    const month = String(createdAt.getUTCMonth() + 1).padStart(2, '0');
    const day = String(createdAt.getUTCDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    const displayDate = `${String(year).slice(-2)}${month}${day}`;

    const sequence = await tx.parcelTrackingSequence.upsert({
      where: {
        businessId_dateKey: { businessId, dateKey },
      },
      create: {
        businessId,
        dateKey,
        lastValue: 1,
      },
      update: {
        lastValue: { increment: 1 },
      },
      select: { lastValue: true },
    });

    if (sequence.lastValue > 999) {
      throw new ConflictException('Daily parcel tracking number limit reached');
    }

    return `SLV${destination}${displayDate}-${String(sequence.lastValue).padStart(3, '0')}`;
  }

  private async resolveUserProfile(
    userId: number,
    businessId: number,
    client: Prisma.TransactionClient = this.prismaService,
  ): Promise<{ courierId?: number; driverId?: number }> {
    const user = await client.user.findFirst({
      where: {
        id: userId,
        businessId,
        isBlocked: false,
        isDeleted: false,
      },
      select: {
        type: true,
        courierProfile: { select: { id: true, isDeleted: true } },
        driverProfile: { select: { id: true, isDeleted: true } },
      },
    });

    if (
      user?.type === UserType.ParcelCourier &&
      user.courierProfile &&
      !user.courierProfile.isDeleted
    ) {
      return { courierId: user.courierProfile.id };
    }
    if (
      user?.type === UserType.InternationalDriver &&
      user.driverProfile &&
      !user.driverProfile.isDeleted
    ) {
      return { driverId: user.driverProfile.id };
    }

    throw new NotFoundException('User has no active operational profile');
  }

  async markAsPickedUp(
    parcelId: number,
    businessId: number,
    userId: number,
  ): Promise<ParcelDto[]> {
    await this.validateBusinessAccess(businessId);
    const profile = await this.resolveUserProfile(userId, businessId);

    const parcels = await this.prismaService.$transaction(async (tx) => {
      const selectedParcel = await tx.parcel.findFirst({
        where: { id: parcelId, businessId, isDeleted: false },
        select: { id: true, groupId: true, journeyId: true },
      });
      if (!selectedParcel) {
        throw new NotFoundException('Parcel not found');
      }

      const where = selectedParcel.groupId
        ? {
            businessId,
            groupId: selectedParcel.groupId,
            journeyId: selectedParcel.journeyId,
            isDeleted: false,
          }
        : { businessId, id: selectedParcel.id, isDeleted: false };
      const group = await tx.parcel.findMany({ where });
      const isSameHandler = (parcel: (typeof group)[number]) =>
        parcel.pickedUpAt != null &&
        parcel.pickedUpByCourierId === (profile.courierId ?? null) &&
        parcel.pickedUpByDriverId === (profile.driverId ?? null);

      if (group.every(isSameHandler)) {
        return tx.parcel.findMany({
          where,
          include: {
            sender: true,
            recipient: true,
            originAddress: { include: { country: true } },
            ...parcelDestinationInclude,
            pickedUpByCourier: { include: { user: true } },
            pickedUpByDriver: { include: { user: true } },
          },
          orderBy: { id: 'asc' },
        });
      }

      if (group.some((parcel) => parcel.pickedUpAt && !isSameHandler(parcel))) {
        throw new ConflictException(
          'Parcel group has already been picked up by another handler',
        );
      }

      const terminalStatuses: DeliveryStatus[] = [
        DeliveryStatus.Delivered,
        DeliveryStatus.Cancelled,
        DeliveryStatus.Returned,
        DeliveryStatus.Lost,
      ];
      if (
        group.some((parcel) => terminalStatuses.includes(parcel.deliveryStatus))
      ) {
        throw new ConflictException('Terminal parcels cannot be picked up');
      }

      const pickedUpAt =
        group.find((parcel) => isSameHandler(parcel))?.pickedUpAt ?? new Date();
      await tx.parcel.updateMany({
        where,
        data: {
          pickedUpByCourierId: profile.courierId ?? null,
          pickedUpByDriverId: profile.driverId ?? null,
          pickedUpAt,
          deliveryStatus: DeliveryStatus.PickedUp,
        },
      });
      await tx.auditLog.createMany({
        data: group.map((parcel) =>
          parcelEvent(
            parcel.id,
            businessId,
            userId,
            AuditAction.UPDATE,
            'ParcelPickedUp',
            'Marked parcel as picked up',
          ),
        ),
      });

      return tx.parcel.findMany({
        where,
        include: {
          sender: true,
          recipient: true,
          originAddress: { include: { country: true } },
          ...parcelDestinationInclude,
          pickedUpByCourier: { include: { user: true } },
          pickedUpByDriver: { include: { user: true } },
        },
        orderBy: { id: 'asc' },
      });
    });

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'Parcel',
      description: `Marked ${parcels.length} parcels as picked up`,
      metadata: { parcelIds: parcels.map((parcel) => parcel.id) },
      businessId,
    });

    const parcelsWithGroupSize = await this.attachGroupSize(parcels);
    return parcelsWithGroupSize.map((parcel) => new ParcelDto(parcel));
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
      select: {
        businessId: true,
        deliveryStatus: true,
        destinationType: true,
        isArchived: true,
      },
    });

    if (!parcel || parcel.businessId !== businessId) {
      throw new NotFoundException('Parcel not found');
    }
    if (parcel.isArchived) {
      throw new ConflictException('Archived parcels cannot be delivered');
    }
    const expectedStatus =
      parcel.destinationType === ParcelDestinationType.NovaPostWarehouse
        ? DeliveryStatus.AtNovaPostWarehouse
        : DeliveryStatus.AtDestinationWarehouse;
    if (parcel.deliveryStatus !== expectedStatus) {
      throw new ConflictException(
        `Parcel must be ${expectedStatus} before delivery`,
      );
    }

    const note = await this.prismaService.$transaction(async (tx) => {
      const created = await tx.parcelNote.create({
        data: { content, parcelId, userId },
        include: { user: true },
      });
      await tx.auditLog.create({
        data: parcelEvent(
          parcelId,
          businessId,
          userId,
          AuditAction.CREATE,
          'NoteAdded',
          'Added parcel note',
        ),
      });
      return created;
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

    await this.prismaService.$transaction(async (tx) => {
      await tx.parcelNote.delete({ where: { id: noteId } });
      await tx.auditLog.create({
        data: parcelEvent(
          note.parcelId,
          businessId,
          userId,
          AuditAction.DELETE,
          'NoteRemoved',
          'Removed parcel note',
        ),
      });
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

    const profile = await this.resolveUserProfile(userId, businessId);

    const updatedParcel = await this.prismaService.$transaction(async (tx) => {
      const result = await tx.parcel.update({
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
          ...parcelDestinationInclude,
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
      await tx.auditLog.create({
        data: parcelEvent(
          parcelId,
          businessId,
          userId,
          AuditAction.UPDATE,
          'ParcelDelivered',
          'Marked parcel as delivered',
        ),
      });
      return result;
    });

    return new ParcelDto(updatedParcel);
  }

  async transitionStatus(
    parcelId: number,
    body: TransitionParcelStatusDto,
    user: UserRequestType,
  ): Promise<ParcelDto> {
    await this.validateBusinessAccess(user.businessId, user);

    const allowed: Partial<Record<DeliveryStatus, DeliveryStatus[]>> = {
      [DeliveryStatus.AwaitingPickup]: [
        DeliveryStatus.PickedUp,
        DeliveryStatus.AtOriginWarehouse,
        DeliveryStatus.Cancelled,
        DeliveryStatus.Lost,
      ],
      [DeliveryStatus.PickedUp]: [
        DeliveryStatus.AtOriginWarehouse,
        DeliveryStatus.Cancelled,
        DeliveryStatus.Lost,
      ],
      [DeliveryStatus.AtOriginWarehouse]: [
        DeliveryStatus.InTransit,
        DeliveryStatus.Cancelled,
        DeliveryStatus.Lost,
      ],
      [DeliveryStatus.InTransit]: [
        DeliveryStatus.AtDestinationWarehouse,
        DeliveryStatus.Lost,
      ],
      [DeliveryStatus.AtDestinationWarehouse]: [
        DeliveryStatus.AtNovaPostWarehouse,
        DeliveryStatus.Delivered,
        DeliveryStatus.Lost,
      ],
      [DeliveryStatus.AtNovaPostWarehouse]: [
        DeliveryStatus.Delivered,
        DeliveryStatus.Lost,
      ],
    };

    const updated = await this.prismaService.$transaction(async (tx) => {
      const parcel = await tx.parcel.findFirst({
        where: {
          id: parcelId,
          businessId: user.businessId,
          isDeleted: false,
        },
      });
      if (!parcel) throw new NotFoundException('Parcel not found');
      if (parcel.isArchived) {
        throw new ConflictException('Archived parcels cannot change status');
      }
      if (parcel.isDamaged) {
        throw new ConflictException(
          'Resolve the parcel damage report before changing status',
        );
      }
      if (parcel.updatedAt.toISOString() !== body.expectedUpdatedAt) {
        throw new ConflictException('Parcel was changed by another user');
      }
      if (!allowed[parcel.deliveryStatus]?.includes(body.toStatus)) {
        throw new ConflictException(
          `Parcel cannot move from ${parcel.deliveryStatus} to ${body.toStatus}`,
        );
      }

      const requiresReason = (
        [DeliveryStatus.Cancelled, DeliveryStatus.Lost] as DeliveryStatus[]
      ).includes(body.toStatus);
      if (requiresReason && !body.reason?.trim()) {
        throw new BadRequestException('A reason is required');
      }

      const isNovaPostDestination =
        parcel.destinationType === ParcelDestinationType.NovaPostWarehouse;
      if (
        body.toStatus === DeliveryStatus.AtNovaPostWarehouse &&
        !isNovaPostDestination
      ) {
        throw new ConflictException(
          'Only Nova Poshta parcels can be handed to Nova Poshta',
        );
      }
      const novaPostTrackingNumber = body.novaPostTrackingNumber
        ?.replace(/\D/g, '')
        .slice(0, 14);
      if (
        body.toStatus === DeliveryStatus.AtNovaPostWarehouse &&
        (novaPostTrackingNumber ?? parcel.novaPostTrackingNumber ?? '').replace(
          /\D/g,
          '',
        ).length !== 14
      ) {
        throw new BadRequestException(
          'Nova Poshta tracking number must contain 14 digits',
        );
      }

      const batchId = randomUUID();
      const now = new Date();
      const profile =
        user.type === UserType.InternationalDriver ||
        user.type === UserType.ParcelCourier
          ? await this.resolveUserProfile(user.id, user.businessId, tx)
          : {};
      const statusData: Prisma.ParcelUncheckedUpdateManyInput = {
        deliveryStatus: body.toStatus,
        isLost: body.toStatus === DeliveryStatus.Lost,
      };
      if (body.toStatus === DeliveryStatus.PickedUp) {
        statusData.pickedUpAt = now;
        if (profile.driverId) {
          statusData.pickedUpByDriverId = profile.driverId;
        }
        if (profile.courierId) {
          statusData.pickedUpByCourierId = profile.courierId;
        }
      }
      if (body.toStatus === DeliveryStatus.AtNovaPostWarehouse) {
        statusData.novaPostTrackingNumber =
          novaPostTrackingNumber ?? parcel.novaPostTrackingNumber;
      }
      if (body.toStatus === DeliveryStatus.Delivered) {
        statusData.deliveredAt = now;
        if (
          parcel.deliveryStatus !== DeliveryStatus.AtNovaPostWarehouse &&
          profile.driverId
        ) {
          statusData.deliveredByDriverId = profile.driverId;
        }
        if (
          parcel.deliveryStatus !== DeliveryStatus.AtNovaPostWarehouse &&
          profile.courierId
        ) {
          statusData.deliveredByCourierId = profile.courierId;
        }
      }

      const updateResult = await tx.parcel.updateMany({
        where: { id: parcelId, updatedAt: parcel.updatedAt },
        data: statusData,
      });
      if (updateResult.count !== 1) {
        throw new ConflictException('Parcel was changed by another user');
      }
      await tx.parcelStatusTransition.create({
        data: {
          parcelId,
          businessId: user.businessId,
          journeyId: parcel.journeyId,
          batchId,
          fromStatus: parcel.deliveryStatus,
          toStatus: body.toStatus,
          actorId: user.id,
          reason: body.reason?.trim(),
        },
      });
      await tx.auditLog.create({
        data: parcelEvent(
          parcelId,
          user.businessId,
          user.id,
          AuditAction.UPDATE,
          'ParcelStatusChanged',
          'Changed parcel delivery status',
          {
            fromStatus: parcel.deliveryStatus,
            toStatus: body.toStatus,
            reason: body.reason?.trim(),
            batchId,
          },
        ),
      });
      return tx.parcel.findUniqueOrThrow({
        where: { id: parcelId },
        include: parcelDestinationInclude,
      });
    });

    return new ParcelDto(updated);
  }

  async reverseStatusTransition(
    parcelId: number,
    body: ReverseParcelStatusDto,
    user: UserRequestType,
  ): Promise<ParcelDto> {
    const canCorrect =
      user.isAdmin || user.isSuperAdmin || user.type === UserType.Manager;
    if (!canCorrect) {
      throw new ForbiddenException('Only managers can correct parcel status');
    }
    await this.validateBusinessAccess(user.businessId, user);

    const updated = await this.prismaService.$transaction(async (tx) => {
      const parcel = await tx.parcel.findFirst({
        where: { id: parcelId, businessId: user.businessId, isDeleted: false },
      });
      if (!parcel) throw new NotFoundException('Parcel not found');
      if (parcel.updatedAt.toISOString() !== body.expectedUpdatedAt) {
        throw new ConflictException('Parcel was changed by another user');
      }
      const previous = await tx.parcelStatusTransition.findFirst({
        where: { parcelId, businessId: user.businessId },
        orderBy: { createdAt: 'desc' },
      });
      if (!previous || previous.isCorrection) {
        throw new ConflictException('No status transition can be reversed');
      }
      const journeyTransition = previous.journeyId
        ? await tx.journeyStatusTransition.findFirst({
            where: {
              journeyId: previous.journeyId,
              businessId: user.businessId,
              batchId: previous.batchId,
            },
            select: { id: true },
          })
        : null;
      if (journeyTransition) {
        throw new ConflictException(
          'Journey status changes must be reversed from the journey',
        );
      }
      if (parcel.deliveryStatus !== previous.toStatus) {
        throw new ConflictException('Parcel has changed since this transition');
      }

      const batchId = randomUUID();
      const data: Prisma.ParcelUncheckedUpdateManyInput = {
        deliveryStatus: previous.fromStatus,
        isLost: previous.fromStatus === DeliveryStatus.Lost,
      };
      if (previous.toStatus === DeliveryStatus.PickedUp) {
        data.pickedUpAt = null;
        data.pickedUpByDriverId = null;
        data.pickedUpByCourierId = null;
      }
      if (previous.toStatus === DeliveryStatus.Delivered) {
        data.deliveredAt = null;
        data.deliveredByDriverId = null;
        data.deliveredByCourierId = null;
      }
      const updateResult = await tx.parcel.updateMany({
        where: { id: parcelId, updatedAt: parcel.updatedAt },
        data,
      });
      if (updateResult.count !== 1) {
        throw new ConflictException('Parcel was changed by another user');
      }
      await tx.parcelStatusTransition.create({
        data: {
          parcelId,
          businessId: user.businessId,
          journeyId: parcel.journeyId,
          batchId,
          fromStatus: previous.toStatus,
          toStatus: previous.fromStatus,
          actorId: user.id,
          reason: body.reason.trim(),
          isCorrection: true,
          reversesBatchId: previous.batchId,
        },
      });
      await tx.auditLog.create({
        data: parcelEvent(
          parcelId,
          user.businessId,
          user.id,
          AuditAction.UPDATE,
          'ParcelStatusCorrected',
          'Reversed parcel delivery status',
          {
            fromStatus: previous.toStatus,
            toStatus: previous.fromStatus,
            reason: body.reason.trim(),
            batchId,
            reversesBatchId: previous.batchId,
          },
        ),
      });
      return tx.parcel.findUniqueOrThrow({
        where: { id: parcelId },
        include: parcelDestinationInclude,
      });
    });

    return new ParcelDto(updated);
  }

  async correctStatus(
    parcelId: number,
    body: CorrectParcelStatusDto,
    user: UserRequestType,
  ): Promise<ParcelDto> {
    await this.validateBusinessAccess(user.businessId, user);
    const reason = body.reason?.trim() || undefined;

    const updated = await this.prismaService.$transaction(async (tx) => {
      const parcel = await tx.parcel.findFirst({
        where: { id: parcelId, businessId: user.businessId, isDeleted: false },
      });
      if (!parcel) throw new NotFoundException('Parcel not found');
      if (parcel.isArchived) {
        throw new ConflictException('Archived parcels cannot change status');
      }
      if (parcel.updatedAt.toISOString() !== body.expectedUpdatedAt) {
        throw new ConflictException('Parcel was changed by another user');
      }
      const novaPostTrackingNumber = body.novaPostTrackingNumber
        ?.replace(/\D/g, '')
        .slice(0, 14);
      const isNovaPostTrackingCorrection =
        parcel.deliveryStatus === DeliveryStatus.AtNovaPostWarehouse &&
        body.toStatus === DeliveryStatus.AtNovaPostWarehouse &&
        novaPostTrackingNumber?.length === 14 &&
        novaPostTrackingNumber !==
          parcel.novaPostTrackingNumber?.replace(/\D/g, '');
      if (
        parcel.deliveryStatus === body.toStatus &&
        !isNovaPostTrackingCorrection
      ) {
        throw new ConflictException('Parcel already has this status');
      }
      if (
        body.toStatus === DeliveryStatus.AtNovaPostWarehouse &&
        parcel.destinationType !== ParcelDestinationType.NovaPostWarehouse
      ) {
        throw new ConflictException(
          'Only Nova Poshta parcels can use the Nova Poshta status',
        );
      }
      if (
        body.toStatus === DeliveryStatus.AtNovaPostWarehouse &&
        (novaPostTrackingNumber ?? parcel.novaPostTrackingNumber ?? '').replace(
          /\D/g,
          '',
        ).length !== 14
      ) {
        throw new BadRequestException(
          'Nova Poshta tracking number must contain 14 digits',
        );
      }

      const now = new Date();
      const pickupStatuses: DeliveryStatus[] = [
        DeliveryStatus.PickedUp,
        DeliveryStatus.AtOriginWarehouse,
        DeliveryStatus.InTransit,
        DeliveryStatus.AtDestinationWarehouse,
        DeliveryStatus.AtNovaPostWarehouse,
        DeliveryStatus.Delivered,
      ];
      const data: Prisma.ParcelUncheckedUpdateManyInput = {
        deliveryStatus: body.toStatus,
        isLost: body.toStatus === DeliveryStatus.Lost,
      };
      if (!pickupStatuses.includes(body.toStatus)) {
        data.pickedUpAt = null;
        data.pickedUpByDriverId = null;
        data.pickedUpByCourierId = null;
      } else if (!parcel.pickedUpAt) {
        data.pickedUpAt = now;
      }
      if (body.toStatus === DeliveryStatus.Delivered) {
        data.deliveredAt = parcel.deliveredAt ?? now;
      } else {
        data.deliveredAt = null;
        data.deliveredByDriverId = null;
        data.deliveredByCourierId = null;
      }
      if (body.toStatus === DeliveryStatus.AtNovaPostWarehouse) {
        data.novaPostTrackingNumber =
          novaPostTrackingNumber ?? parcel.novaPostTrackingNumber;
      }

      const result = await tx.parcel.updateMany({
        where: { id: parcelId, updatedAt: parcel.updatedAt },
        data,
      });
      if (result.count !== 1) {
        throw new ConflictException('Parcel was changed by another user');
      }
      const batchId = randomUUID();
      await tx.parcelStatusTransition.create({
        data: {
          parcelId,
          businessId: user.businessId,
          journeyId: parcel.journeyId,
          batchId,
          fromStatus: parcel.deliveryStatus,
          toStatus: body.toStatus,
          actorId: user.id,
          reason,
          isCorrection: true,
        },
      });
      await tx.auditLog.create({
        data: parcelEvent(
          parcelId,
          user.businessId,
          user.id,
          AuditAction.UPDATE,
          'ParcelStatusCorrected',
          'Corrected parcel delivery status',
          {
            fromStatus: parcel.deliveryStatus,
            toStatus: body.toStatus,
            reason,
            batchId,
          },
        ),
      });
      return tx.parcel.findUniqueOrThrow({
        where: { id: parcelId },
        include: parcelDestinationInclude,
      });
    });
    return new ParcelDto(updated);
  }

  async reportDamage(
    parcelId: number,
    body: ReportParcelDamageDto,
    user: UserRequestType,
  ): Promise<ParcelDto> {
    await this.validateBusinessAccess(user.businessId, user);
    const terminal: DeliveryStatus[] = [
      DeliveryStatus.Delivered,
      DeliveryStatus.Cancelled,
      DeliveryStatus.Returned,
      DeliveryStatus.Lost,
    ];
    const updated = await this.prismaService.$transaction(async (tx) => {
      const parcel = await tx.parcel.findFirst({
        where: { id: parcelId, businessId: user.businessId, isDeleted: false },
      });
      if (!parcel) throw new NotFoundException('Parcel not found');
      if (parcel.isArchived || terminal.includes(parcel.deliveryStatus)) {
        throw new ConflictException('This parcel cannot be marked as damaged');
      }
      if (parcel.isDamaged) {
        throw new ConflictException('Parcel is already marked as damaged');
      }
      if (parcel.updatedAt.toISOString() !== body.expectedUpdatedAt) {
        throw new ConflictException('Parcel was changed by another user');
      }
      const result = await tx.parcel.updateMany({
        where: { id: parcelId, updatedAt: parcel.updatedAt },
        data: { isDamaged: true },
      });
      if (result.count !== 1) {
        throw new ConflictException('Parcel was changed by another user');
      }
      await tx.auditLog.create({
        data: parcelEvent(
          parcelId,
          user.businessId,
          user.id,
          AuditAction.UPDATE,
          'ParcelDamaged',
          'Reported parcel damage',
          { reason: body.reason.trim(), status: parcel.deliveryStatus },
        ),
      });
      return tx.parcel.findUniqueOrThrow({
        where: { id: parcelId },
        include: parcelDestinationInclude,
      });
    });
    return new ParcelDto(updated);
  }

  async resolveDamage(
    parcelId: number,
    body: ResolveParcelDamageDto,
    user: UserRequestType,
  ): Promise<ParcelDto> {
    await this.validateBusinessAccess(user.businessId, user);
    const updated = await this.prismaService.$transaction(async (tx) => {
      const parcel = await tx.parcel.findFirst({
        where: { id: parcelId, businessId: user.businessId, isDeleted: false },
      });
      if (!parcel) throw new NotFoundException('Parcel not found');
      if (!parcel.isDamaged) {
        throw new ConflictException('Parcel is not marked as damaged');
      }
      if (parcel.updatedAt.toISOString() !== body.expectedUpdatedAt) {
        throw new ConflictException('Parcel was changed by another user');
      }
      const result = await tx.parcel.updateMany({
        where: { id: parcelId, updatedAt: parcel.updatedAt },
        data: { isDamaged: false },
      });
      if (result.count !== 1) {
        throw new ConflictException('Parcel was changed by another user');
      }
      await tx.auditLog.create({
        data: parcelEvent(
          parcelId,
          user.businessId,
          user.id,
          AuditAction.UPDATE,
          'ParcelDamageResolved',
          'Resumed delivery after parcel damage',
          { status: parcel.deliveryStatus },
        ),
      });
      return tx.parcel.findUniqueOrThrow({
        where: { id: parcelId },
        include: parcelDestinationInclude,
      });
    });
    return new ParcelDto(updated);
  }
}
