import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { JourneyDto } from './dtos/journey.dto';
import { JourneyNoteDto } from './dtos/journey-note.dto';
import { ParcelDto } from 'src/parcels/dtos/parcel.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateJourneyDto } from './dtos/create-journey.dto';
import { UpdateJourneyDto } from './dtos/update-journey.dto';
import { ParcelsService } from 'src/parcels/parcels.service';
import { VehiclesService } from 'src/vehicles/vehicles.service';
import { DriversService } from 'src/profiles/drivers/drivers.service';
import { Pagination } from 'src/dtos/pagination.dto';
import prismaWithPagination from 'src/prisma/prisma-client';
import { BaseTenantService } from 'src/common/base-tenant.service';
import { VehicleDto } from 'src/vehicles/dtos/vehicle.dto';
import { JourneyNumberService } from './services/journey-number.service';
import { UserRequestType } from 'src/users/decorators/current-user.decorator';
import {
  AuditAction,
  DeliveryStatus,
  JourneyStatus,
  ParcelDestinationType,
  Prisma,
  UserType,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { JourneyParcelMetricsDto } from './dtos/journey-parcel-metrics.dto';
import {
  JOURNEY_PARCEL_COUNT_TARGET,
  JOURNEY_WEIGHT_TARGET_KG,
} from './constants/journey-parcel-metrics.constants';
import {
  CancelJourneyDto,
  ReverseJourneyStatusDto,
  TransitionJourneyDto,
} from './dtos/transition-journey.dto';

@Injectable()
export class JourneysService extends BaseTenantService {
  constructor(
    prismaService: PrismaService,
    private readonly parcelsService: ParcelsService,
    private readonly vehiclesService: VehiclesService,
    private readonly driversService: DriversService,
    private readonly journeyNumberService: JourneyNumberService,
  ) {
    super(prismaService);
  }

  async createJourney(
    body: CreateJourneyDto,
    currentUser: UserRequestType,
  ): Promise<JourneyDto> {
    const {
      startCountryId,
      endCountryId,
      vehicleId,
      departureDate,
      parcels,
      hasTrailer,
      notes,
    } = body;
    const businessId = currentUser.businessId;
    const driverProfiles =
      currentUser.type === UserType.InternationalDriver
        ? [(await this.findDriverProfileForUser(currentUser.id, businessId)).id]
        : body.driverProfiles;

    await this.validateBusinessAccess(businessId);

    // Validate and get vehicle - ensure it's active and belongs to business
    const vehicle = await this.vehiclesService.findOne(vehicleId, businessId);

    if (!vehicle.isActive) {
      throw new NotFoundException(
        'Vehicle is not active and cannot be assigned to journeys',
      );
    }

    // Validate driver profiles exist and belong to the business
    const foundDrivers =
      await this.driversService.findManyByIds(driverProfiles);

    const foundParcels = await this.parcelsService.findParcelsByIds(
      parcels,
      businessId,
    );

    const journeyNumber =
      await this.journeyNumberService.generateUniqueJourneyNumber(
        departureDate,
        businessId,
      );

    // Validate journey number before proceeding
    if (!journeyNumber || typeof journeyNumber !== 'string') {
      throw new Error(`Invalid journey number generated: ${journeyNumber}`);
    }

    // Use transaction to ensure atomicity
    const createdJourney = await this.prismaService.$transaction(async (tx) => {
      // Check for duplicate journey (idempotency)
      const existingJourney = await tx.journey.findFirst({
        where: {
          startCountryId,
          endCountryId,
          vehicleId,
          departureDate,
          businessId,
          isDeleted: false,
        },
        include: {
          driverProfiles: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  imageUrl: {
                    select: {
                      id: true,
                      url: true,
                    },
                  },
                },
              },
            },
          },
          parcels: {
            include: {
              sender: true,
              recipient: true,
            },
          },
          vehicle: true,
          startCountry: true,
          endCountry: true,
        },
      });

      if (existingJourney) {
        // Journey already exists, return existing journey (idempotent)
        return existingJourney;
      }

      // Check for vehicle scheduling conflicts within transaction
      const conflictingJourneys = await tx.journey.findMany({
        where: {
          vehicleId,
          businessId,
          departureDate: {
            gte: new Date(
              departureDate.getFullYear(),
              departureDate.getMonth(),
              departureDate.getDate(),
            ),
            lt: new Date(
              departureDate.getFullYear(),
              departureDate.getMonth(),
              departureDate.getDate() + 1,
            ),
          },
          status: {
            in: [JourneyStatus.Scheduled, JourneyStatus.InTransit],
          },
          isDeleted: false,
        },
      });

      if (conflictingJourneys.length > 0) {
        throw new ConflictException(
          `Vehicle is already assigned to ${conflictingJourneys.length} journey(s) on ${departureDate.toDateString()}. Please choose a different vehicle or date.`,
        );
      }

      // Create the journey
      const newJourney = await tx.journey.create({
        data: {
          journeyNumber,
          startCountryId,
          endCountryId,
          vehicleId,
          departureDate,
          hasTrailer: hasTrailer || false,
          businessId,
          parcels: {
            connect: foundParcels.map((parcel) => ({ id: parcel.id })),
          },
          driverProfiles: {
            connect: foundDrivers.map((driver) => ({ id: driver.id })),
          },
        },
        include: {
          driverProfiles: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  imageUrl: {
                    select: {
                      id: true,
                      url: true,
                    },
                  },
                },
              },
            },
          },
          parcels: {
            include: {
              sender: true,
              recipient: true,
            },
          },
          vehicle: true,
          startCountry: true,
          endCountry: true,
        },
      });

      if (notes?.trim()) {
        await tx.journeyNote.create({
          data: {
            journeyId: newJourney.id,
            userId: currentUser.id,
            content: notes.trim(),
          },
        });
      }

      return newJourney;
    });

    if (!createdJourney) {
      throw new Error('Failed to create or retrieve journey');
    }

    return this.findOneForUser(createdJourney.id, currentUser);
  }

  async findParcelsByJourneyId(
    page: number,
    journeyId: number,
    businessId: number,
  ): Promise<Pagination<ParcelDto>> {
    await this.validateBusinessAccess(businessId);

    // First validate that the journey belongs to the business
    const journey = await this.prismaService.journey.findUnique({
      where: { id: journeyId },
      select: { businessId: true },
    });

    if (!journey || journey.businessId !== businessId) {
      throw new NotFoundException('Journey not found');
    }

    try {
      const [journeyParcelsWithPagination, metadata] =
        await prismaWithPagination.parcel
          .paginate({
            where: {
              journeyId,
              businessId, // Add business filter for extra security
            },
            include: {
              sender: true,
              recipient: true,
            },
          })
          .withPages({ page });

      const journeyParcels = journeyParcelsWithPagination.map(
        (parcel) => new ParcelDto(parcel),
      );

      return {
        items: journeyParcels,
        ...metadata,
      };
    } catch (error) {
      throw new NotFoundException(error);
    }
  }

  async findAll(
    businessId: number,
    page?: number,
    isCompleted?: boolean,
    driverProfileId?: number,
    startDate?: Date,
    endDate?: Date,
    startCountryId?: number,
    endCountryId?: number,
    currentUser?: UserRequestType,
  ): Promise<Pagination<JourneyDto> | JourneyDto[]> {
    await this.validateBusinessAccess(businessId);

    let whereClause: any = this.getBusinessWhere(
      businessId,
      {
        isDeleted: false,
        ...(isCompleted !== undefined && { isCompleted }),
        ...(isCompleted === false && {
          isArchived: false,
          status: {
            in: [JourneyStatus.Scheduled, JourneyStatus.InTransit],
          },
        }),
      },
    );

    let effectiveDriverProfileId = driverProfileId;

    if (currentUser?.type === UserType.InternationalDriver) {
      const ownProfile = await this.findDriverProfileForUser(
        currentUser.id,
        businessId,
      );

      if (driverProfileId && driverProfileId !== ownProfile.id) {
        throw new ForbiddenException(
          'Drivers can only access their own journeys',
        );
      }

      effectiveDriverProfileId = ownProfile.id;
    }

    if (effectiveDriverProfileId) {
      await this.validateDriverProfileAccess(
        effectiveDriverProfileId,
        businessId,
      );
      whereClause = {
        ...whereClause,
        driverProfiles: {
          some: {
            id: effectiveDriverProfileId,
          },
        },
      };
    }

    if (startDate || endDate) {
      whereClause = {
        ...whereClause,
        departureDate: {
          ...(startDate && { gte: startDate }),
          ...(endDate && {
            lte: new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1),
          }),
        },
      };
    }

    if (startCountryId) {
      whereClause = {
        ...whereClause,
        startCountryId,
      };
    }

    if (endCountryId) {
      whereClause = {
        ...whereClause,
        endCountryId,
      };
    }

    if (page) {
      // Return paginated results
      const [journeysWithPagination, metadata] =
        await prismaWithPagination.journey
          .paginate({
            orderBy: {
              departureDate: 'desc',
            },
            where: whereClause,
            include: {
              driverProfiles: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      imageUrl: {
                        select: {
                          id: true,
                          url: true,
                        },
                      },
                    },
                  },
                },
              },
              parcels: {
                include: {
                  sender: true,
                  recipient: true,
                },
              },
              vehicle: true,
              startCountry: true,
              endCountry: true,
            },
          })
          .withPages({ page });

      const journeys = journeysWithPagination.map(
        (journey) => new JourneyDto(journey),
      );

      return {
        items: journeys,
        ...metadata,
      };
    } else {
      // Return all results (for simple lists)
      const allJourneys = await this.prismaService.journey.findMany({
        where: whereClause,
        orderBy: {
          departureDate: 'desc',
        },
        include: {
          driverProfiles: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  imageUrl: {
                    select: {
                      id: true,
                      url: true,
                    },
                  },
                },
              },
            },
          },
          parcels: {
            include: {
              sender: true,
              recipient: true,
            },
          },
          vehicle: true,
          startCountry: true,
          endCountry: true,
        },
      });

      return allJourneys.map((journey) => new JourneyDto(journey));
    }
  }

  async findOne(id: number, businessId: number): Promise<JourneyDto> {
    await this.validateBusinessAccess(businessId);

    const journey = await this.prismaService.journey.findUnique({
      where: {
        id,
      },
      include: {
        driverProfiles: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                imageUrl: {
                  select: {
                    id: true,
                    url: true,
                  },
                },
              },
            },
          },
        },
        parcels: {
          include: {
            sender: true,
            recipient: true,
          },
        },
        vehicle: true,
        startCountry: true,
        endCountry: true,
        journeyNotes: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!journey || journey.businessId !== businessId) {
      throw new NotFoundException('Journey not found');
    }

    return new JourneyDto(journey);
  }

  async findOneForUser(
    id: number,
    currentUser: UserRequestType,
  ): Promise<JourneyDto> {
    const journey = await this.findOne(id, currentUser.businessId);

    if (currentUser.type === UserType.InternationalDriver) {
      const ownProfile = await this.findDriverProfileForUser(
        currentUser.id,
        currentUser.businessId,
      );
      const isAssigned = journey.driverProfiles.some(
        (driver) => driver.id === ownProfile.id,
      );

      if (!isAssigned) {
        throw new ForbiddenException(
          'Drivers can only access their own journeys',
        );
      }
    }

    return journey;
  }

  async getParcelMetrics(
    id: number,
    currentUser: UserRequestType,
  ): Promise<JourneyParcelMetricsDto> {
    const { businessId } = currentUser;
    await this.validateBusinessAccess(businessId, currentUser);

    const driverProfile =
      currentUser.type === UserType.InternationalDriver
        ? await this.findDriverProfileForUser(currentUser.id, businessId)
        : null;

    return this.prismaService.$transaction(
      async (tx) => {
        const journey = await tx.journey.findFirst({
          where: { id, businessId, isDeleted: false },
          select: {
            id: true,
            driverProfiles: { select: { id: true } },
          },
        });

        if (!journey) {
          throw new NotFoundException('Journey not found');
        }

        if (
          driverProfile &&
          !journey.driverProfiles.some(({ id }) => id === driverProfile.id)
        ) {
          throw new ForbiddenException(
            'Drivers can only access their own journeys',
          );
        }

        const parcelWhere = {
          journeyId: id,
          businessId,
          isDeleted: false,
        };
        const [
          aggregate,
          collectedParcelCount,
          statusGroups,
          readyForDeliveryCount,
        ] = await Promise.all([
          tx.parcel.aggregate({
            where: parcelWhere,
            _count: { _all: true },
            _sum: { weight: true },
          }),
          tx.parcel.count({
            where: { ...parcelWhere, pickedUpAt: { not: null } },
          }),
          tx.parcel.groupBy({
            by: ['deliveryStatus'],
            where: parcelWhere,
            _count: { _all: true },
          }),
          tx.parcel.count({
            where: {
              ...parcelWhere,
              OR: [
                {
                  deliveryStatus: DeliveryStatus.AtDestinationWarehouse,
                  destinationType: {
                    not: ParcelDestinationType.NovaPostWarehouse,
                  },
                },
                { deliveryStatus: DeliveryStatus.AtNovaPostWarehouse },
              ],
            },
          }),
        ]);

        const totalParcelCount = aggregate._count._all;
        const totalWeightKg = Number(aggregate._sum.weight ?? 0);
        const collectionProgressPercent = totalParcelCount
          ? Math.round((collectedParcelCount / totalParcelCount) * 100)
          : 0;
        const countsByStatus = Object.fromEntries(
          Object.values(DeliveryStatus).map((status) => [status, 0]),
        );
        statusGroups.forEach((group) => {
          countsByStatus[group.deliveryStatus] = group._count._all;
        });
        const readyParcelCount =
          countsByStatus[DeliveryStatus.PickedUp] +
          countsByStatus[DeliveryStatus.AtOriginWarehouse];
        const terminalCount =
          countsByStatus[DeliveryStatus.Delivered] +
          countsByStatus[DeliveryStatus.Cancelled] +
          countsByStatus[DeliveryStatus.Returned] +
          countsByStatus[DeliveryStatus.Lost];

        return new JourneyParcelMetricsDto({
          journeyId: id,
          totalParcelCount,
          collectedParcelCount,
          totalWeightKg,
          collectionProgressPercent,
          parcelCountTarget: JOURNEY_PARCEL_COUNT_TARGET,
          weightTargetKg: JOURNEY_WEIGHT_TARGET_KG,
          parcelCountTargetProgressPercent: Math.min(
            100,
            Math.round(
              (totalParcelCount / JOURNEY_PARCEL_COUNT_TARGET) * 100,
            ),
          ),
          weightTargetProgressPercent: Math.min(
            100,
            Math.round((totalWeightKg / JOURNEY_WEIGHT_TARGET_KG) * 100),
          ),
          readyParcelCount,
          blockingParcelCount: Math.max(
            0,
            totalParcelCount - readyParcelCount - terminalCount,
          ),
          novaPostWarehouseCount:
            countsByStatus[DeliveryStatus.AtNovaPostWarehouse],
          deliveredParcelCount: countsByStatus[DeliveryStatus.Delivered],
          readyForDeliveryCount,
          countsByStatus,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async startJourney(
    id: number,
    body: TransitionJourneyDto,
    currentUser: UserRequestType,
  ): Promise<JourneyDto> {
    await this.findOneForUser(id, currentUser);
    const readyStatuses: DeliveryStatus[] = [
      DeliveryStatus.PickedUp,
      DeliveryStatus.AtOriginWarehouse,
    ];
    const terminalStatuses: DeliveryStatus[] = [
      DeliveryStatus.Delivered,
      DeliveryStatus.Cancelled,
      DeliveryStatus.Returned,
      DeliveryStatus.Lost,
    ];

    await this.prismaService.$transaction(
      async (tx) => {
        const journey = await tx.journey.findFirst({
          where: {
            id,
            businessId: currentUser.businessId,
            isDeleted: false,
          },
        });
        if (!journey) throw new NotFoundException('Journey not found');
        if (journey.status !== JourneyStatus.Scheduled) {
          throw new ConflictException('Only scheduled journeys can start');
        }
        if (journey.updatedAt.toISOString() !== body.expectedUpdatedAt) {
          throw new ConflictException('Journey was changed by another user');
        }

        const parcels = await tx.parcel.findMany({
          where: {
            journeyId: id,
            businessId: currentUser.businessId,
            isDeleted: false,
          },
          select: { id: true, deliveryStatus: true, isDamaged: true },
        });
        const active = parcels.filter(
          (parcel) => !terminalStatuses.includes(parcel.deliveryStatus),
        );
        if (active.length === 0) {
          throw new ConflictException('Journey has no active parcels');
        }
        const blockers = active.filter(
          (parcel) =>
            parcel.isDamaged || !readyStatuses.includes(parcel.deliveryStatus),
        );
        if (blockers.length > 0) {
          throw new ConflictException({
            message: 'Journey contains parcels that are not ready',
            parcelIds: blockers.map(({ id: parcelId }) => parcelId),
          });
        }

        const batchId = randomUUID();
        const actualDepartureAt = new Date();
        const updatedParcels = await tx.parcel.updateMany({
          where: {
            journeyId: id,
            businessId: currentUser.businessId,
            isDeleted: false,
            deliveryStatus: { in: readyStatuses },
          },
          data: { deliveryStatus: DeliveryStatus.InTransit },
        });
        if (updatedParcels.count !== active.length) {
          throw new ConflictException(
            'Journey manifest changed while starting the journey',
          );
        }
        await tx.parcelStatusTransition.createMany({
          data: active.map((parcel) => ({
            parcelId: parcel.id,
            businessId: currentUser.businessId,
            journeyId: id,
            batchId,
            fromStatus: parcel.deliveryStatus,
            toStatus: DeliveryStatus.InTransit,
            actorId: currentUser.id,
          })),
        });
        await this.createParcelJourneyEvents(
          tx,
          active,
          currentUser,
          id,
          batchId,
          DeliveryStatus.InTransit,
          'ParcelInTransit',
          'Journey started; parcel is in transit',
        );
        const updateResult = await tx.journey.updateMany({
          where: { id, updatedAt: journey.updatedAt },
          data: {
            status: JourneyStatus.InTransit,
            actualDepartureAt,
            isCompleted: false,
          },
        });
        if (updateResult.count !== 1) {
          throw new ConflictException('Journey was changed by another user');
        }
        await tx.journeyStatusTransition.create({
          data: {
            journeyId: id,
            businessId: currentUser.businessId,
            batchId,
            fromStatus: JourneyStatus.Scheduled,
            toStatus: JourneyStatus.InTransit,
            actorId: currentUser.id,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.findOneForUser(id, currentUser);
  }

  async completeJourney(
    id: number,
    body: TransitionJourneyDto,
    currentUser: UserRequestType,
  ): Promise<JourneyDto> {
    await this.findOneForUser(id, currentUser);
    const terminalStatuses: DeliveryStatus[] = [
      DeliveryStatus.Delivered,
      DeliveryStatus.Cancelled,
      DeliveryStatus.Returned,
      DeliveryStatus.Lost,
    ];

    await this.prismaService.$transaction(
      async (tx) => {
        const journey = await tx.journey.findFirst({
          where: {
            id,
            businessId: currentUser.businessId,
            isDeleted: false,
          },
        });
        if (!journey) throw new NotFoundException('Journey not found');
        if (journey.status !== JourneyStatus.InTransit) {
          throw new ConflictException('Only in-transit journeys can complete');
        }
        if (journey.updatedAt.toISOString() !== body.expectedUpdatedAt) {
          throw new ConflictException('Journey was changed by another user');
        }

        const parcels = await tx.parcel.findMany({
          where: {
            journeyId: id,
            businessId: currentUser.businessId,
            isDeleted: false,
          },
          select: { id: true, deliveryStatus: true, isDamaged: true },
        });
        const active = parcels.filter(
          (parcel) => !terminalStatuses.includes(parcel.deliveryStatus),
        );
        const blockers = active.filter(
          (parcel) =>
            parcel.isDamaged ||
            parcel.deliveryStatus !== DeliveryStatus.InTransit,
        );
        if (blockers.length > 0) {
          throw new ConflictException({
            message: 'Journey contains parcels that are not in transit',
            parcelIds: blockers.map(({ id: parcelId }) => parcelId),
          });
        }

        const batchId = randomUUID();
        const arrivalDate = new Date();
        const updatedParcels = await tx.parcel.updateMany({
          where: {
            journeyId: id,
            businessId: currentUser.businessId,
            isDeleted: false,
            deliveryStatus: DeliveryStatus.InTransit,
          },
          data: { deliveryStatus: DeliveryStatus.AtDestinationWarehouse },
        });
        if (updatedParcels.count !== active.length) {
          throw new ConflictException(
            'Journey manifest changed while completing the journey',
          );
        }
        await tx.parcelStatusTransition.createMany({
          data: active.map((parcel) => ({
            parcelId: parcel.id,
            businessId: currentUser.businessId,
            journeyId: id,
            batchId,
            fromStatus: DeliveryStatus.InTransit,
            toStatus: DeliveryStatus.AtDestinationWarehouse,
            actorId: currentUser.id,
          })),
        });
        await this.createParcelJourneyEvents(
          tx,
          active,
          currentUser,
          id,
          batchId,
          DeliveryStatus.AtDestinationWarehouse,
          'ParcelAtDestinationWarehouse',
          'Journey completed; parcel reached destination warehouse',
        );
        const updateResult = await tx.journey.updateMany({
          where: { id, updatedAt: journey.updatedAt },
          data: {
            status: JourneyStatus.Completed,
            isCompleted: true,
            arrivalDate,
          },
        });
        if (updateResult.count !== 1) {
          throw new ConflictException('Journey was changed by another user');
        }
        await tx.journeyStatusTransition.create({
          data: {
            journeyId: id,
            businessId: currentUser.businessId,
            batchId,
            fromStatus: JourneyStatus.InTransit,
            toStatus: JourneyStatus.Completed,
            actorId: currentUser.id,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.findOneForUser(id, currentUser);
  }

  async cancelJourney(
    id: number,
    body: CancelJourneyDto,
    currentUser: UserRequestType,
  ): Promise<JourneyDto> {
    await this.findOneForUser(id, currentUser);
    await this.prismaService.$transaction(async (tx) => {
      const journey = await tx.journey.findFirst({
        where: { id, businessId: currentUser.businessId, isDeleted: false },
      });
      if (!journey) throw new NotFoundException('Journey not found');
      if (journey.status !== JourneyStatus.Scheduled) {
        throw new ConflictException('Only scheduled journeys can be cancelled');
      }
      if (journey.updatedAt.toISOString() !== body.expectedUpdatedAt) {
        throw new ConflictException('Journey was changed by another user');
      }
      const batchId = randomUUID();
      await tx.parcel.updateMany({
        where: { journeyId: id, businessId: currentUser.businessId },
        data: { journeyId: null },
      });
      await tx.journey.update({
        where: { id },
        data: { status: JourneyStatus.Cancelled, isCompleted: false },
      });
      await tx.journeyStatusTransition.create({
        data: {
          journeyId: id,
          businessId: currentUser.businessId,
          batchId,
          fromStatus: JourneyStatus.Scheduled,
          toStatus: JourneyStatus.Cancelled,
          actorId: currentUser.id,
          reason: body.reason.trim(),
        },
      });
    });
    return this.findOneForUser(id, currentUser);
  }

  async deliverEligibleParcels(
    id: number,
    body: TransitionJourneyDto,
    currentUser: UserRequestType,
  ): Promise<{ updatedCount: number }> {
    await this.findOneForUser(id, currentUser);

    const updatedCount = await this.prismaService.$transaction(
      async (tx) => {
        const journey = await tx.journey.findFirst({
          where: { id, businessId: currentUser.businessId, isDeleted: false },
        });
        if (!journey) throw new NotFoundException('Journey not found');
        if (journey.status !== JourneyStatus.Completed) {
          throw new ConflictException(
            'Parcels can be bulk delivered only after journey completion',
          );
        }
        if (journey.updatedAt.toISOString() !== body.expectedUpdatedAt) {
          throw new ConflictException('Journey was changed by another user');
        }

        const eligible = await tx.parcel.findMany({
          where: {
            journeyId: id,
            businessId: currentUser.businessId,
            isDeleted: false,
            isDamaged: false,
            OR: [
              {
                deliveryStatus: DeliveryStatus.AtDestinationWarehouse,
                destinationType: {
                  not: ParcelDestinationType.NovaPostWarehouse,
                },
              },
              { deliveryStatus: DeliveryStatus.AtNovaPostWarehouse },
            ],
          },
          select: { id: true, deliveryStatus: true },
        });
        if (eligible.length === 0) {
          throw new ConflictException('No parcels are ready for delivery');
        }

        const batchId = randomUUID();
        const deliveredAt = new Date();
        const updateResult = await tx.parcel.updateMany({
          where: {
            id: { in: eligible.map(({ id: parcelId }) => parcelId) },
            deliveryStatus: {
              in: [
                DeliveryStatus.AtDestinationWarehouse,
                DeliveryStatus.AtNovaPostWarehouse,
              ],
            },
          },
          data: {
            deliveryStatus: DeliveryStatus.Delivered,
            deliveredAt,
          },
        });
        if (updateResult.count !== eligible.length) {
          throw new ConflictException(
            'Journey manifest changed during bulk delivery',
          );
        }
        await tx.parcelStatusTransition.createMany({
          data: eligible.map((parcel) => ({
            parcelId: parcel.id,
            businessId: currentUser.businessId,
            journeyId: id,
            batchId,
            fromStatus: parcel.deliveryStatus,
            toStatus: DeliveryStatus.Delivered,
            actorId: currentUser.id,
          })),
        });
        await this.createParcelJourneyEvents(
          tx,
          eligible,
          currentUser,
          id,
          batchId,
          DeliveryStatus.Delivered,
          'ParcelDelivered',
          'Bulk delivered from journey manifest',
        );
        return updateResult.count;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return { updatedCount };
  }

  async reverseStatus(
    id: number,
    body: ReverseJourneyStatusDto,
    currentUser: UserRequestType,
  ): Promise<JourneyDto> {
    const canCorrect =
      currentUser.isAdmin ||
      currentUser.isSuperAdmin ||
      currentUser.type === UserType.Manager;
    if (!canCorrect) {
      throw new ForbiddenException('Only managers can correct journey status');
    }
    await this.findOneForUser(id, currentUser);

    await this.prismaService.$transaction(
      async (tx) => {
        const journey = await tx.journey.findFirst({
          where: { id, businessId: currentUser.businessId, isDeleted: false },
        });
        if (!journey) throw new NotFoundException('Journey not found');
        if (journey.updatedAt.toISOString() !== body.expectedUpdatedAt) {
          throw new ConflictException('Journey was changed by another user');
        }
        const previous = await tx.journeyStatusTransition.findFirst({
          where: { journeyId: id, businessId: currentUser.businessId },
          orderBy: { createdAt: 'desc' },
        });
        if (!previous || previous.isCorrection) {
          throw new ConflictException('No journey transition can be reversed');
        }
        if (journey.status !== previous.toStatus) {
          throw new ConflictException('Journey has changed since this transition');
        }
        if (previous.toStatus === JourneyStatus.Cancelled) {
          throw new ConflictException(
            'Cancelled journeys must be rescheduled as a new journey',
          );
        }

        const transitions = await tx.parcelStatusTransition.findMany({
          where: {
            journeyId: id,
            businessId: currentUser.businessId,
            batchId: previous.batchId,
          },
        });
        const currentParcels = await tx.parcel.findMany({
          where: { id: { in: transitions.map(({ parcelId }) => parcelId) } },
          select: { id: true, deliveryStatus: true },
        });
        const currentById = new Map(
          currentParcels.map((parcel) => [parcel.id, parcel.deliveryStatus]),
        );
        if (
          transitions.some(
            (transition) =>
              currentById.get(transition.parcelId) !== transition.toStatus,
          )
        ) {
          throw new ConflictException(
            'One or more parcels changed after the journey transition',
          );
        }

        const correctionBatchId = randomUUID();
        for (const transition of transitions) {
          await tx.parcel.update({
            where: { id: transition.parcelId },
            data: { deliveryStatus: transition.fromStatus },
          });
        }
        if (transitions.length > 0) {
          await tx.parcelStatusTransition.createMany({
            data: transitions.map((transition) => ({
              parcelId: transition.parcelId,
              businessId: currentUser.businessId,
              journeyId: id,
              batchId: correctionBatchId,
              fromStatus: transition.toStatus,
              toStatus: transition.fromStatus,
              actorId: currentUser.id,
              reason: body.reason.trim(),
              isCorrection: true,
              reversesBatchId: previous.batchId,
            })),
          });
          await tx.auditLog.createMany({
            data: transitions.map((transition) => ({
              userId: currentUser.id,
              businessId: currentUser.businessId,
              action: AuditAction.UPDATE,
              entityType: 'Parcel',
              entityId: String(transition.parcelId),
              description: 'Reversed journey parcel delivery status',
              method: 'PARCEL_EVENT',
              metadata: {
                eventType: 'ParcelStatusCorrected',
                details: {
                  journeyId: id,
                  fromStatus: transition.toStatus,
                  toStatus: transition.fromStatus,
                  reason: body.reason.trim(),
                  batchId: correctionBatchId,
                  reversesBatchId: previous.batchId,
                },
              },
            })),
          });
        }
        await tx.journey.update({
          where: { id },
          data: {
            status: previous.fromStatus,
            isCompleted: previous.fromStatus === JourneyStatus.Completed,
            actualDepartureAt:
              previous.toStatus === JourneyStatus.InTransit
                ? null
                : journey.actualDepartureAt,
            arrivalDate:
              previous.toStatus === JourneyStatus.Completed
                ? null
                : journey.arrivalDate,
          },
        });
        await tx.journeyStatusTransition.create({
          data: {
            journeyId: id,
            businessId: currentUser.businessId,
            batchId: correctionBatchId,
            fromStatus: previous.toStatus,
            toStatus: previous.fromStatus,
            actorId: currentUser.id,
            reason: body.reason.trim(),
            isCorrection: true,
            reversesBatchId: previous.batchId,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.findOneForUser(id, currentUser);
  }

  private async createParcelJourneyEvents(
    tx: Prisma.TransactionClient,
    parcels: { id: number; deliveryStatus: DeliveryStatus }[],
    user: UserRequestType,
    journeyId: number,
    batchId: string,
    toStatus: DeliveryStatus,
    eventType: string,
    description: string,
  ) {
    await tx.auditLog.createMany({
      data: parcels.map((parcel) => ({
        userId: user.id,
        businessId: user.businessId,
        action: AuditAction.UPDATE,
        entityType: 'Parcel',
        entityId: String(parcel.id),
        description,
        method: 'PARCEL_EVENT',
        metadata: {
          eventType,
          details: {
            journeyId,
            fromStatus: parcel.deliveryStatus,
            toStatus,
            batchId,
          },
        },
      })),
    });
  }

  async update(
    id: number,
    attrs: Partial<UpdateJourneyDto>,
    currentUser: UserRequestType,
  ): Promise<JourneyDto> {
    const journey = await this.findOneForUser(id, currentUser);

    if (!journey) {
      throw new Error('Journey not found');
    }
    if (journey.status !== JourneyStatus.Scheduled) {
      throw new ConflictException('Only scheduled journeys can be edited');
    }

    // Prepare update data
    const updateData: any = { ...attrs };
    const noteContent = attrs.notes?.trim();

    delete updateData.notes;

    if (attrs.startCountryId !== undefined) {
      updateData.startCountry = { connect: { id: attrs.startCountryId } };
      delete updateData.startCountryId;
    }

    if (attrs.endCountryId !== undefined) {
      updateData.endCountry = { connect: { id: attrs.endCountryId } };
      delete updateData.endCountryId;
    }

    if (attrs.vehicleId !== undefined) {
      await this.vehiclesService.findOne(
        attrs.vehicleId,
        currentUser.businessId,
      );
      updateData.vehicle = { connect: { id: attrs.vehicleId } };
      delete updateData.vehicleId;
    }

    if (currentUser.type === UserType.InternationalDriver) {
      delete updateData.driverProfiles;
    }

    // Handle driverProfiles if provided
    if (
      currentUser.type !== UserType.InternationalDriver &&
      attrs.driverProfiles !== undefined
    ) {
      // Remove driverProfiles from direct update data
      delete updateData.driverProfiles;

      // Update will handle driver profiles separately
      updateData.driverProfiles = {
        set: [], // First disconnect all existing drivers
        connect: attrs.driverProfiles.map((driverId) => ({ id: driverId })), // Then connect new ones
      };
    }

    await this.prismaService.journey.update({
      where: {
        id,
      },
      data: updateData,
    });

    if (noteContent && noteContent !== journey.notes) {
      await this.prismaService.journeyNote.create({
        data: {
          journeyId: id,
          userId: currentUser.id,
          content: noteContent,
        },
      });
    }

    return this.findOneForUser(id, currentUser);
  }

  async remove(id: number, businessId: number): Promise<void> {
    await this.validateBusinessAccess(businessId);

    // First check if journey belongs to the business
    const journey = await this.prismaService.journey.findUnique({
      where: { id },
      select: { businessId: true },
    });

    if (!journey || journey.businessId !== businessId) {
      throw new NotFoundException('Journey not found');
    }

    await this.prismaService.journey.delete({
      where: {
        id,
      },
    });
  }

  private async validateDriverProfileAccess(
    driverProfileId: number,
    businessId: number,
  ): Promise<void> {
    const driverProfile = await this.prismaService.driverProfile.findUnique({
      where: { id: driverProfileId },
      include: {
        user: {
          select: { businessId: true },
        },
      },
    });

    if (!driverProfile) {
      throw new NotFoundException('Driver profile not found');
    }

    if (driverProfile.user.businessId !== businessId) {
      throw new NotFoundException('Driver profile not found');
    }
  }

  private async findDriverProfileForUser(userId: number, businessId: number) {
    const driverProfile = await this.prismaService.driverProfile.findFirst({
      where: {
        userId,
        isDeleted: false,
        user: { businessId },
      },
    });

    if (!driverProfile) {
      throw new NotFoundException('Driver profile not found');
    }

    return driverProfile;
  }

  async getAvailableVehicles(
    departureDate: Date,
    businessId: number,
  ): Promise<VehicleDto[]> {
    await this.validateBusinessAccess(businessId);

    // Get all active vehicles for the business
    const allVehicles = await this.vehiclesService.findAll(businessId);
    const activeVehicles = allVehicles.filter((vehicle) => vehicle.isActive);

    // Get vehicles that are already assigned on this date
    const assignedVehicleIds = await this.prismaService.journey.findMany({
      where: {
        businessId,
        departureDate: {
          gte: new Date(
            departureDate.getFullYear(),
            departureDate.getMonth(),
            departureDate.getDate(),
          ),
          lt: new Date(
            departureDate.getFullYear(),
            departureDate.getMonth(),
            departureDate.getDate() + 1,
          ),
        },
        status: {
          in: [JourneyStatus.Scheduled, JourneyStatus.InTransit],
        },
        isDeleted: false,
      },
      select: {
        vehicleId: true,
      },
    });

    const assignedIds = assignedVehicleIds.map((journey) => journey.vehicleId);

    // Return vehicles that are not assigned on this date
    return activeVehicles.filter(
      (vehicle) => !assignedIds.includes(vehicle.id),
    );
  }

  async addNote(
    journeyId: number,
    content: string,
    userId: number,
    businessId: number,
  ): Promise<JourneyNoteDto> {
    await this.validateBusinessAccess(businessId);

    const journey = await this.prismaService.journey.findUnique({
      where: { id: journeyId },
      select: { businessId: true },
    });

    if (!journey || journey.businessId !== businessId) {
      throw new NotFoundException('Journey not found');
    }

    const note = await this.prismaService.journeyNote.create({
      data: {
        content,
        journeyId,
        userId,
      },
      include: {
        user: true,
      },
    });

    return new JourneyNoteDto(note);
  }

  async getNotes(
    journeyId: number,
    businessId: number,
  ): Promise<JourneyNoteDto[]> {
    await this.validateBusinessAccess(businessId);

    const journey = await this.prismaService.journey.findUnique({
      where: { id: journeyId },
      select: { businessId: true },
    });

    if (!journey || journey.businessId !== businessId) {
      throw new NotFoundException('Journey not found');
    }

    const notes = await this.prismaService.journeyNote.findMany({
      where: { journeyId },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return notes.map((note) => new JourneyNoteDto(note));
  }

  async deleteNote(
    noteId: number,
    userId: number,
    businessId: number,
  ): Promise<void> {
    await this.validateBusinessAccess(businessId);

    const note = await this.prismaService.journeyNote.findUnique({
      where: { id: noteId },
      include: {
        journey: {
          select: { businessId: true },
        },
      },
    });

    if (!note || note.journey.businessId !== businessId) {
      throw new NotFoundException('Note not found');
    }

    if (note.userId !== userId) {
      throw new NotFoundException('You can only delete notes that you created');
    }

    await this.prismaService.journeyNote.delete({
      where: { id: noteId },
    });
  }
}
