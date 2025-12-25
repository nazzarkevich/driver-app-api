import {
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
    {
      startCountryId,
      endCountryId,
      vehicleId,
      departureDate,
      parcels,
      driverProfiles,
      hasTrailer,
    }: CreateJourneyDto,
    businessId: number,
  ): Promise<JourneyDto> {
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
          isCompleted: false,
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

      return newJourney;
    });

    if (!createdJourney) {
      throw new Error('Failed to create or retrieve journey');
    }

    return new JourneyDto(createdJourney);
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
  ): Promise<Pagination<JourneyDto> | JourneyDto[]> {
    await this.validateBusinessAccess(businessId);

    let whereClause: any = this.getBusinessWhere(
      businessId,
      isCompleted !== undefined ? { isCompleted } : {},
    );

    if (driverProfileId) {
      await this.validateDriverProfileAccess(driverProfileId, businessId);
      whereClause = {
        ...whereClause,
        driverProfiles: {
          some: {
            id: driverProfileId,
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
      },
    });

    if (!journey || journey.businessId !== businessId) {
      throw new NotFoundException('Journey not found');
    }

    return new JourneyDto(journey);
  }

  async update(
    id: number,
    attrs: Partial<UpdateJourneyDto>,
    businessId: number,
  ): Promise<JourneyDto> {
    const journey = await this.findOne(id, businessId);

    if (!journey) {
      throw new Error('Journey not found');
    }

    // Prepare update data
    const updateData: any = { ...attrs };

    // Handle driverProfiles if provided
    if (attrs.driverProfiles !== undefined) {
      // Remove driverProfiles from direct update data
      delete updateData.driverProfiles;

      // Update will handle driver profiles separately
      updateData.driverProfiles = {
        set: [], // First disconnect all existing drivers
        connect: attrs.driverProfiles.map((driverId) => ({ id: driverId })), // Then connect new ones
      };
    }

    const updatedJourney = await this.prismaService.journey.update({
      where: {
        id,
      },
      data: updateData,
      include: {
        startCountry: true,
        endCountry: true,
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
      },
    });

    return new JourneyDto(updatedJourney);
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
        isCompleted: false,
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
      throw new NotFoundException(
        'You can only delete notes that you created',
      );
    }

    await this.prismaService.journeyNote.delete({
      where: { id: noteId },
    });
  }
}
