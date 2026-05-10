import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseTenantService } from 'src/common/base-tenant.service';
import { UserRequestType } from 'src/users/decorators/current-user.decorator';
import { CreateParcelTypeDto } from './dtos/create-parcel-type.dto';
import { UpdateParcelTypeDto } from './dtos/update-parcel-type.dto';
import { ParcelTypeDto } from './dtos/parcel-type.dto';

@Injectable()
export class ParcelTypesService extends BaseTenantService {
  constructor(prismaService: PrismaService) {
    super(prismaService);
  }

  async create(
    user: UserRequestType,
    createParcelTypeDto: CreateParcelTypeDto,
  ): Promise<ParcelTypeDto> {
    await this.validateBusinessAccess(user.businessId, user);

    const parcelType = await this.prismaService.parcelType.create({
      data: {
        ...createParcelTypeDto,
        businessId: user.businessId,
      },
    });

    return new ParcelTypeDto(parcelType);
  }

  async findAll(
    businessId: number,
    currentUser?: UserRequestType,
    isActiveOnly = false,
  ): Promise<ParcelTypeDto[]> {
    await this.validateBusinessAccess(businessId, currentUser);

    const effectiveBusinessId = currentUser?.isSuperAdmin
      ? businessId
      : currentUser?.businessId || businessId;

    const parcelTypes = await this.prismaService.parcelType.findMany({
      where: {
        OR: [{ businessId: effectiveBusinessId }, { businessId: null }],
        isDeleted: false,
        ...(isActiveOnly && { isActive: true }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return parcelTypes.map((pt) => new ParcelTypeDto(pt));
  }

  async findOne(
    id: number,
    businessId: number,
    currentUser?: UserRequestType,
  ): Promise<ParcelTypeDto> {
    await this.validateBusinessAccess(businessId, currentUser);

    const parcelType = await this.prismaService.parcelType.findUnique({
      where: { id },
    });

    const effectiveBusinessId = currentUser?.isSuperAdmin
      ? parcelType?.businessId
      : currentUser?.businessId || businessId;

    const hasAccess =
      currentUser?.isSuperAdmin ||
      parcelType?.businessId === null ||
      parcelType?.businessId === effectiveBusinessId;

    if (!parcelType || parcelType.isDeleted || !hasAccess) {
      throw new NotFoundException('Parcel type not found');
    }

    return new ParcelTypeDto(parcelType);
  }

  async update(
    id: number,
    businessId: number,
    updateParcelTypeDto: UpdateParcelTypeDto,
    currentUser?: UserRequestType,
  ): Promise<ParcelTypeDto> {
    await this.validateBusinessAccess(businessId, currentUser);

    const parcelType = await this.prismaService.parcelType.findUnique({
      where: { id },
    });

    const canModify =
      currentUser?.isSuperAdmin ||
      (parcelType?.businessId !== null &&
        parcelType?.businessId === currentUser?.businessId);

    if (!parcelType || parcelType.isDeleted || !canModify) {
      throw new NotFoundException('Parcel type not found');
    }

    const updated = await this.prismaService.parcelType.update({
      where: { id },
      data: updateParcelTypeDto,
    });

    return new ParcelTypeDto(updated);
  }

  async remove(
    id: number,
    businessId: number,
    currentUser?: UserRequestType,
  ): Promise<void> {
    await this.validateBusinessAccess(businessId, currentUser);

    const parcelType = await this.prismaService.parcelType.findUnique({
      where: { id },
    });

    const canModify =
      currentUser?.isSuperAdmin ||
      (parcelType?.businessId !== null &&
        parcelType?.businessId === currentUser?.businessId);

    if (!parcelType || parcelType.isDeleted || !canModify) {
      throw new NotFoundException('Parcel type not found');
    }

    await this.prismaService.parcelType.update({
      where: { id },
      data: { isDeleted: true },
    });
  }
}
