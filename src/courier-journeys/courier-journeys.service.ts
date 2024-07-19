import { Injectable, NotFoundException } from '@nestjs/common';

import { Pagination } from 'src/dtos/pagination.dto';
import { ParcelDto } from 'src/parcels/dtos/parcel.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import prismaWithPagination from 'src/prisma/prisma-client';
import { ParcelsService } from 'src/parcels/parcels.service';
import { CourierJourneyDto } from './dtos/courier-journey.dto';
import { VehiclesService } from 'src/vehicles/vehicles.service';
import { CouriersService } from 'src/profiles/couriers/couriers.service';
import { UpdateCourierJourneyDto } from './dtos/update-courier-journey.dto';
import { CreateCourierJourneyDto } from './dtos/create-courier-journey.dto';

@Injectable()
export class CourierJourneysService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly parcelsService: ParcelsService,
    private readonly vehiclesService: VehiclesService,
    private readonly couriersService: CouriersService,
  ) {}

  async createCourierJourney({
    vehicleId,
    couriersIds,
    parcels,
    ...rest
  }: CreateCourierJourneyDto): Promise<void> {
    const vehicle = await this.vehiclesService.findOne(vehicleId);
    const foundParcels = await this.parcelsService.findParcelsByIds(parcels);
    const foundCouriers = await this.couriersService.findManyByIds(couriersIds);

    await this.prismaService.courierJourney.create({
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
        courierProfiles: {
          connect: foundCouriers.map((courier) => ({ id: courier.id })),
        },
      },
    });
  }

  async findAll(
    page: number,
    isCompleted: boolean,
  ): Promise<Pagination<CourierJourneyDto>> {
    const [courierJourneysWithPagination, metadata] =
      await prismaWithPagination.courierJourney
        .paginate({
          orderBy: {
            createdAt: 'desc',
          },
          where: {
            isCompleted,
          },
          include: {
            courierProfiles: true,
            parcels: true,
            vehicle: true,
          },
        })
        .withPages({ page });

    const courierJourneys = courierJourneysWithPagination.map(
      (courierJourney) => new CourierJourneyDto(courierJourney),
    );

    return {
      items: courierJourneys,
      ...metadata,
    };
  }

  async findParcelsByCourierJourneyId(
    page: number,
    courierJourneyId: number,
  ): Promise<Pagination<ParcelDto>> {
    try {
      const [parcelsWithPagination, metadata] =
        await prismaWithPagination.parcel
          .paginate({
            where: {
              courierJourneyId,
            },
            include: {
              sender: true,
              recipient: true,
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
    } catch (error) {
      throw new NotFoundException(error);
    }
  }

  async findOne(id: number): Promise<CourierJourneyDto> {
    const journey = await this.prismaService.courierJourney.findUnique({
      where: {
        id,
      },
      include: {
        courierProfiles: true,
        parcels: true,
        vehicle: true,
      },
    });

    if (!journey) {
      throw new NotFoundException('Courier journey not found');
    }

    return new CourierJourneyDto(journey);
  }

  async updateCourierJourney(
    id: number,
    attrs: Partial<UpdateCourierJourneyDto>,
  ): Promise<CourierJourneyDto> {
    const journey = await this.findOne(id);

    if (!journey) {
      throw new NotFoundException('Courier journey not found');
    }

    console.log('attrs: ', attrs);

    const updatedJourney = await this.prismaService.courierJourney.update({
      where: {
        id,
      },
      data: attrs,
    });

    return new CourierJourneyDto(updatedJourney);
  }
}
