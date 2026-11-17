import { Injectable, NotFoundException } from '@nestjs/common';

import { VehicleDto } from './dtos/vehicle.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateVehicleDto } from './dtos/create-vehicle.dto';
import { UpdateVehicleDto } from './dtos/update-vehicle.dto';
import { BaseTenantService } from 'src/common/base-tenant.service';
import { Prisma } from '@prisma/client';
import prismaWithPagination from 'src/prisma/prisma-client';
import type { Pagination } from 'src/dtos/pagination.dto';
import type { UserRequestType } from 'src/users/decorators/current-user.decorator';

export interface VehicleListFilters {
  page?: number;
  search?: string;
  isActive?: boolean;
}

@Injectable()
export class VehiclesService extends BaseTenantService {
  constructor(prismaService: PrismaService) {
    super(prismaService);
  }

  async findAll(businessId: number): Promise<VehicleDto[]>;
  async findAll(
    businessId: number,
    filters: VehicleListFilters,
    currentUser?: UserRequestType,
  ): Promise<VehicleDto[] | Pagination<VehicleDto>>;
  async findAll(
    businessId: number,
    filters: VehicleListFilters = {},
    currentUser?: UserRequestType,
  ): Promise<VehicleDto[] | Pagination<VehicleDto>> {
    await this.validateBusinessAccess(businessId, currentUser);
    const search = filters.search?.trim();
    const where: Prisma.VehicleWhereInput = {
      ...this.getBusinessFilter(businessId, currentUser),
      isDeleted: false,
      ...(filters.isActive === undefined ? {} : { isActive: filters.isActive }),
      ...(search
        ? {
            OR: ['plateNumber', 'make', 'model'].map((field) => ({
              [field]: { contains: search, mode: 'insensitive' },
            })),
          }
        : {}),
    };
    const orderBy: Prisma.VehicleOrderByWithRelationInput[] = [
      { createdAt: 'desc' },
      { id: 'desc' },
    ];
    if (filters.page !== undefined) {
      const [items, metadata] = await prismaWithPagination.vehicle
        .paginate({ where, orderBy })
        .withPages({ page: filters.page });
      return {
        items: items.map((vehicle) => new VehicleDto(vehicle)),
        ...metadata,
      };
    }
    const vehicles = await this.prismaService.vehicle.findMany({
      where,
      orderBy,
    });
    return vehicles.map((vehicle) => new VehicleDto(vehicle));
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

  async findOne(
    id: number,
    businessId: number,
    currentUser?: UserRequestType,
  ): Promise<VehicleDto> {
    await this.validateBusinessAccess(businessId, currentUser);

    const vehicle = await this.prismaService.vehicle.findUnique({
      where: {
        id,
      },
    });

    if (!vehicle || vehicle.businessId !== businessId || vehicle.isDeleted) {
      throw new NotFoundException();
    }

    return new VehicleDto(vehicle);
  }

  async updateVehicle(
    id: number,
    updateDto: UpdateVehicleDto,
    businessId: number,
  ): Promise<VehicleDto> {
    await this.validateBusinessAccess(businessId);

    const vehicle = await this.prismaService.vehicle.findUnique({
      where: { id },
    });

    if (!vehicle || vehicle.businessId !== businessId || vehicle.isDeleted) {
      throw new NotFoundException('Vehicle not found');
    }

    const updated = await this.prismaService.vehicle.update({
      where: { id },
      data: updateDto,
    });

    return new VehicleDto(updated);
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
