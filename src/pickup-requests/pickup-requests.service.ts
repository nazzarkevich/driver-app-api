import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { BaseTenantService } from 'src/common/base-tenant.service';
import { CreatePickupRequestDto } from './dtos/create-pickup-request.dto';
import { UpdatePickupRequestDto } from './dtos/update-pickup-request.dto';

@Injectable()
export class PickupRequestsService extends BaseTenantService {
  constructor(prismaService: PrismaService) {
    super(prismaService);
  }

  async findAll(businessId: number, date?: string) {
    await this.validateBusinessAccess(businessId);

    const where: any = {
      businessId,
      isDeleted: false,
    };

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setUTCHours(23, 59, 59, 999);

      where.scheduledDate = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    return this.prismaService.pickupRequest.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(dto: CreatePickupRequestDto, businessId: number) {
    await this.validateBusinessAccess(businessId);

    return this.prismaService.pickupRequest.create({
      data: {
        customerName: dto.customerName,
        phoneNumber: dto.phoneNumber,
        postcode: dto.postcode.toUpperCase(),
        parcelCount: dto.parcelCount ?? 1,
        scheduledDate: new Date(dto.scheduledDate),
        notes: dto.notes,
        businessId,
      },
    });
  }

  async update(id: number, dto: UpdatePickupRequestDto, businessId: number) {
    await this.validateBusinessAccess(businessId);

    const existing = await this.prismaService.pickupRequest.findUnique({
      where: { id },
      select: { businessId: true, isDeleted: true },
    });

    if (!existing || existing.businessId !== businessId || existing.isDeleted) {
      throw new NotFoundException('Pickup request not found');
    }

    const data: any = {};
    if (dto.customerName !== undefined) data.customerName = dto.customerName;
    if (dto.phoneNumber !== undefined) data.phoneNumber = dto.phoneNumber;
    if (dto.postcode !== undefined) data.postcode = dto.postcode.toUpperCase();
    if (dto.parcelCount !== undefined) data.parcelCount = dto.parcelCount;
    if (dto.scheduledDate !== undefined)
      data.scheduledDate = new Date(dto.scheduledDate);
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.notes !== undefined) data.notes = dto.notes;

    return this.prismaService.pickupRequest.update({
      where: { id },
      data,
    });
  }

  async remove(id: number, businessId: number): Promise<void> {
    await this.validateBusinessAccess(businessId);

    const existing = await this.prismaService.pickupRequest.findUnique({
      where: { id },
      select: { businessId: true, isDeleted: true },
    });

    if (!existing || existing.businessId !== businessId || existing.isDeleted) {
      throw new NotFoundException('Pickup request not found');
    }

    await this.prismaService.pickupRequest.update({
      where: { id },
      data: { isDeleted: true },
    });
  }
}
