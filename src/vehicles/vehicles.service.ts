import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { CreateVehicleDto } from './dtos/create-vehicle.dto';
import { VehicleDto } from './dtos/vehicle.dto';
import { Pagination } from 'src/dtos/pagination.dto';
import prismaWithPagination from 'src/prisma/prisma-client';

@Injectable()
export class VehiclesService {
  constructor(private readonly prismaService: PrismaService) {}

  async create({
    make,
    model,
    plateNumber,
    year,
  }: CreateVehicleDto): Promise<void> {
    await this.prismaService.vehicle.create({
      data: {
        make,
        model,
        plateNumber,
        year,
        businessId: 1, // TODO: pass businessId from currentBusiness
      },
    });
  }

  async findAll(page: number): Promise<Pagination<VehicleDto>> {
    const [parcelsWithPagination, metadata] = await prismaWithPagination.vehicle
      .paginate()
      .withPages({ page });

    const vehicles = parcelsWithPagination.map(
      (vehicle) => new VehicleDto(vehicle),
    );

    return {
      items: vehicles,
      ...metadata,
    };
  }

  async findOne(id: number): Promise<VehicleDto> {
    const vehicle = await this.prismaService.vehicle.findUnique({
      where: {
        id,
      },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle profile not found');
    }

    return new VehicleDto(vehicle);
  }
}
