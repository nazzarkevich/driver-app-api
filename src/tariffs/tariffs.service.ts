import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseTenantService } from 'src/common/base-tenant.service';
import { UserRequestType } from 'src/users/decorators/current-user.decorator';
import { CreateTariffDto } from './dtos/create-tariff.dto';
import { UpdateTariffDto } from './dtos/update-tariff.dto';
import { TariffDto } from './dtos/tariff.dto';

@Injectable()
export class TariffsService extends BaseTenantService {
  constructor(prismaService: PrismaService) {
    super(prismaService);
  }

  async create(
    user: UserRequestType,
    createTariffDto: CreateTariffDto,
  ): Promise<TariffDto> {
    await this.validateBusinessAccess(user.businessId, user);

    const tariff = await this.prismaService.tariff.create({
      data: {
        ...createTariffDto,
        businessId: user.businessId,
      },
    });

    return new TariffDto(tariff);
  }

  async findAll(
    businessId: number,
    currentUser?: UserRequestType,
    isActiveOnly = false,
  ): Promise<TariffDto[]> {
    await this.validateBusinessAccess(businessId, currentUser);

    const whereClause = this.getBusinessWhere(
      businessId,
      {
        ...(isActiveOnly && { isActive: true }),
        isDeleted: false,
      },
      currentUser,
    );

    const tariffs = await this.prismaService.tariff.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return tariffs.map((tariff) => new TariffDto(tariff));
  }

  async findOne(
    id: number,
    businessId: number,
    currentUser?: UserRequestType,
  ): Promise<TariffDto> {
    await this.validateBusinessAccess(businessId, currentUser);

    const tariff = await this.prismaService.tariff.findUnique({
      where: { id },
    });

    if (!tariff || !this.canAccessBusiness(tariff.businessId, currentUser)) {
      throw new NotFoundException('Tariff not found');
    }

    return new TariffDto(tariff);
  }

  async update(
    id: number,
    businessId: number,
    updateTariffDto: UpdateTariffDto,
    currentUser?: UserRequestType,
  ): Promise<TariffDto> {
    await this.validateBusinessAccess(businessId, currentUser);

    const existingTariff = await this.prismaService.tariff.findUnique({
      where: { id },
    });

    if (
      !existingTariff ||
      !this.canAccessBusiness(existingTariff.businessId, currentUser)
    ) {
      throw new NotFoundException('Tariff not found');
    }

    const updatedTariff = await this.prismaService.tariff.update({
      where: { id },
      data: updateTariffDto,
    });

    return new TariffDto(updatedTariff);
  }

  async remove(
    id: number,
    businessId: number,
    currentUser?: UserRequestType,
  ): Promise<void> {
    await this.validateBusinessAccess(businessId, currentUser);

    const tariff = await this.prismaService.tariff.findUnique({
      where: { id },
    });

    if (!tariff || !this.canAccessBusiness(tariff.businessId, currentUser)) {
      throw new NotFoundException('Tariff not found');
    }

    await this.prismaService.tariff.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  async calculatePrice(
    weight: number,
    tariffId: number,
    parcelType: string,
  ): Promise<number> {
    const tariff = await this.prismaService.tariff.findUnique({
      where: { id: tariffId },
    });

    if (!tariff || !tariff.isActive) {
      throw new NotFoundException('Tariff not found or inactive');
    }

    if (!tariff.parcelTypes.includes(parcelType as any)) {
      throw new NotFoundException(
        `Tariff does not support parcel type: ${parcelType}`,
      );
    }

    if (!tariff.isWeightBased) {
      return tariff.minimumPrice;
    }

    if (weight < tariff.weightThreshold) {
      return tariff.minimumPrice;
    }

    return weight * tariff.pricePerKg;
  }
}
