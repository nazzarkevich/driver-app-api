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
import { BaseTenantService } from 'src/common/base-tenant.service';

@Injectable()
export class CourierJourneysService extends BaseTenantService {
  constructor(
    prismaService: PrismaService,
    private readonly parcelsService: ParcelsService,
    private readonly vehiclesService: VehiclesService,
    private readonly couriersService: CouriersService,
  ) {
    super(prismaService);
  }

  async createCourierJourney(
    {
      destination,
      vehicleId,
      departureDate,
      notes,
      parcels,
    }: CreateCourierJourneyDto,
    businessId: number,
  ): Promise<void> {
    await this.validateBusinessAccess(businessId);

    // Validate vehicle exists in the business
    await this.vehiclesService.findOne(vehicleId, businessId);
    const foundParcels = await this.parcelsService.findParcelsByIds(
      parcels,
      businessId,
    );

    await this.prismaService.courierJourney.create({
      data: {
        destination,
        vehicleId,
        departureDate,
        notes,
        businessId,
        parcels: {
          connect: foundParcels.map((parcel) => ({ id: parcel.id })),
        },
      },
    });
  }

  async findAll(businessId: number): Promise<CourierJourneyDto[]> {
    await this.validateBusinessAccess(businessId);

    const allCourierJourneys = await this.prismaService.courierJourney.findMany(
      {
        where: this.getBusinessFilter(businessId),
      },
    );

    return allCourierJourneys.map((journey) => new CourierJourneyDto(journey));
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

  async findOne(id: number, businessId: number): Promise<CourierJourneyDto> {
    await this.validateBusinessAccess(businessId);

    const courierJourney = await this.prismaService.courierJourney.findUnique({
      where: {
        id,
      },
    });

    if (!courierJourney || courierJourney.businessId !== businessId) {
      throw new NotFoundException();
    }

    return new CourierJourneyDto(courierJourney);
  }

  async update(
    id: number,
    attrs: Partial<UpdateCourierJourneyDto>,
    businessId: number,
  ): Promise<CourierJourneyDto> {
    const journey = await this.findOne(id, businessId);

    if (!journey) {
      throw new Error('Courier journey not found');
    }

    Object.assign(journey, attrs);

    const updatedJourney = await this.prismaService.courierJourney.update({
      where: {
        id,
      },
      data: attrs,
    });

    return new CourierJourneyDto(updatedJourney);
  }

  async remove(id: number, businessId: number): Promise<void> {
    await this.validateBusinessAccess(businessId);

    // First check if courier journey belongs to the business
    const journey = await this.prismaService.courierJourney.findUnique({
      where: { id },
      select: { businessId: true },
    });

    if (!journey || journey.businessId !== businessId) {
      throw new NotFoundException('Courier journey not found');
    }

    await this.prismaService.courierJourney.delete({
      where: {
        id,
      },
    });
  }
}
