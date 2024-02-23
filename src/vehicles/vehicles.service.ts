import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { CreateVehicleDto } from './dtos/create-vehicle.dto';
import { VehicleDto } from './dtos/vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private readonly prismaService: PrismaService) {}

  async create({ make, model, plateNumber, year }: CreateVehicleDto) {
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

  async findAll(): Promise<VehicleDto[]> {
    const allVehicles = await this.prismaService.vehicle.findMany({});

    return allVehicles.map((vehicle) => new VehicleDto(vehicle));
  }

  async findOne(id: number) {
    const vehicle = await this.prismaService.vehicle.findUnique({
      where: {
        id,
      },
    });

    if (!vehicle) {
      throw new NotFoundException();
    }

    return new VehicleDto(vehicle);
  }
}
