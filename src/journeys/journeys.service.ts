import { Injectable, NotFoundException } from '@nestjs/common';

import { JourneyDto } from './dtos/journey.dto';
import { ParcelDto } from 'src/parcels/dtos/parcel.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateJourneyDto } from './dtos/create-journey.dto';
import { UpdateJourneyDto } from './dtos/update-journey.dto';
import { ParcelsService } from 'src/parcels/parcels.service';
import { VehiclesService } from 'src/vehicles/vehicles.service';
import { DriversService } from 'src/profiles/drivers/drivers.service';
import { Pagination } from 'src/dtos/pagination.dto';
import prismaWithPagination from 'src/prisma/prisma-client';

@Injectable()
export class JourneysService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly parcelsService: ParcelsService,
    private readonly vehiclesService: VehiclesService,
    private readonly driversService: DriversService,
  ) {}

  async createJourney({
    vehicleId,
    driverIds,
    parcels,
    ...rest
  }: CreateJourneyDto): Promise<void> {
    const foundParcels = await this.parcelsService.findParcelsByIds(parcels);
    const vehicle = await this.vehiclesService.findOne(vehicleId);
    const foundDrivers = await this.driversService.findManyByIds(driverIds);

    await this.prismaService.journey.create({
      data: {
        ...rest,
        vehicle: {
          connect: {
            id: vehicle.id,
          },
        },
        business: {
          connect: {
            id: 1, // TODO: add businessId from currentBusiness
          },
        },
        parcels: {
          connect: foundParcels.map((parcel) => ({ id: parcel.id })),
        },
        driverProfiles: {
          connect: foundDrivers.map((driver) => ({ id: driver.id })),
        },
      },
    });
  }

  async findParcelsByJourneyId(
    page: number,
    journeyId: number,
  ): Promise<Pagination<ParcelDto>> {
    try {
      const [journeyParcelsWithPagination, metadata] =
        await prismaWithPagination.parcel
          .paginate({
            where: {
              journeyId,
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
    page: number,
    isCompleted: boolean,
  ): Promise<Pagination<JourneyDto>> {
    // TODO: return only journey details in the list
    const [journeysWithPagination, metadata] =
      await prismaWithPagination.journey
        .paginate({
          where: {
            isCompleted,
          },
          include: {
            driverProfiles: true,
            parcels: true,
            vehicle: true,
          },
        })
        .withPages({ page });

    const journeys = journeysWithPagination.map(
      (parcel) => new JourneyDto(parcel),
    );

    return {
      items: journeys,
      ...metadata,
    };
  }

  async findOne(id: number): Promise<JourneyDto> {
    const journey = await this.prismaService.journey.findUnique({
      where: {
        id,
      },
      include: {
        driverProfiles: true,
        parcels: true,
        vehicle: true,
      },
    });

    if (!journey) {
      throw new NotFoundException('Journey not found');
    }

    return new JourneyDto(journey);
  }

  async updateJourney(
    id: number,
    attrs: Partial<UpdateJourneyDto>,
  ): Promise<JourneyDto> {
    const journey = await this.findOne(id);

    if (!journey) {
      throw new NotFoundException('Journey not found');
    }

    console.log('attrs: ', attrs);

    const updatedJourney = await this.prismaService.journey.update({
      where: {
        id,
      },
      data: attrs,
    });

    return new JourneyDto(updatedJourney);
  }
}
