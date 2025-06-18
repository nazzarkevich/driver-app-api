import { Injectable, NotFoundException } from '@nestjs/common';

import { VehicleDto } from './dtos/vehicle.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateVehicleDto } from './dtos/create-vehicle.dto';
import { BaseTenantService } from 'src/common/base-tenant.service';

@Injectable()
export class VehiclesService extends BaseTenantService {
  constructor(prismaService: PrismaService) {
    super(prismaService);
  }

  async findAll(businessId: number): Promise<VehicleDto[]> {
    await this.validateBusinessAccess(businessId);

    const allVehicles = await this.prismaService.vehicle.findMany({
      where: this.getBusinessFilter(businessId),
    });

    return allVehicles.map((vehicle) => new VehicleDto(vehicle));
  }

  async createVehicle(
    { plateNumber, model, make, year }: CreateVehicleDto,
    businessId: number,
  ): Promise<void> {
    await this.validateBusinessAccess(businessId);

    await this.prismaService.vehicle.create({
      data: {
        plateNumber,
        model,
        make,
        year,
        businessId,
      },
    });
  }

  async findOne(id: number, businessId: number): Promise<VehicleDto> {
    await this.validateBusinessAccess(businessId);

    const vehicle = await this.prismaService.vehicle.findUnique({
      where: {
        id,
      },
    });

    if (!vehicle || vehicle.businessId !== businessId) {
      throw new NotFoundException();
    }

    return new VehicleDto(vehicle);
  }

  async remove(id: number, businessId: number): Promise<void> {
    await this.validateBusinessAccess(businessId);

    // First check if vehicle belongs to the business
    const vehicle = await this.prismaService.vehicle.findUnique({
      where: { id },
      select: { businessId: true },
    });

    if (!vehicle || vehicle.businessId !== businessId) {
      throw new NotFoundException('Vehicle not found');
    }

    await this.prismaService.vehicle.delete({
      where: {
        id,
      },
    });
  }
}
