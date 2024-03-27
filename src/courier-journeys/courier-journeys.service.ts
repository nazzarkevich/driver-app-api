import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { ParcelsService } from 'src/parcels/parcels.service';
import { VehiclesService } from 'src/vehicles/vehicles.service';
import { CouriersService } from 'src/profiles/couriers/couriers.service';
import { CreateCourierJourneyDto } from './dtos/create-courier-journey.dto';
import { CourierJourneyDto } from './dtos/courier-journey.dto';
import { UpdateCourierJourneyDto } from './dtos/update-courier-journey.dto';
import { ParcelDto } from 'src/parcels/dtos/parcel.dto';

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

  async findAll(): Promise<CourierJourneyDto[]> {
    return await this.prismaService.courierJourney.findMany({
      include: {
        courierProfiles: true,
        parcels: true,
        vehicle: true,
      },
    });
  }

  async findParcelsByCourierJourneyId(
    courierJourneyId: number,
  ): Promise<ParcelDto[]> {
    try {
      const journeyParcels = await this.prismaService.parcel.findMany({
        where: {
          courierJourneyId,
        },
      });

      return journeyParcels.map((parcel) => new ParcelDto(parcel));
    } catch (error) {
      throw new NotFoundException(error);
    }
  }

  async findCompletedCourierJourneys(): Promise<CourierJourneyDto[]> {
    return await this.prismaService.courierJourney.findMany({
      where: {
        isCompleted: true,
      },
      include: {
        courierProfiles: true,
        parcels: true,
        vehicle: true,
      },
    });
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
