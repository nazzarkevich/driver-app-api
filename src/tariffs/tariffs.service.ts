import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseTenantService } from 'src/common/base-tenant.service';
import { UserRequestType } from 'src/users/decorators/current-user.decorator';
import { CreateTariffDto } from './dtos/create-tariff.dto';
import { UpdateTariffDto } from './dtos/update-tariff.dto';
import { TariffDto } from './dtos/tariff.dto';

const tariffInclude = {
  originCountry: true,
};

@Injectable()
export class TariffsService extends BaseTenantService {
  constructor(prismaService: PrismaService) {
    super(prismaService);
  }

  private buildTariffDto(tariff: any): TariffDto {
    return new TariffDto(tariff);
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
      include: tariffInclude,
    });

    return this.buildTariffDto(tariff);
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
      include: tariffInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return tariffs.map((tariff) => this.buildTariffDto(tariff));
  }

  async findOne(
    id: number,
    businessId: number,
    currentUser?: UserRequestType,
  ): Promise<TariffDto> {
    await this.validateBusinessAccess(businessId, currentUser);

    const tariff = await this.prismaService.tariff.findUnique({
      where: { id },
      include: tariffInclude,
    });

    if (!tariff || !this.canAccessBusiness(tariff.businessId, currentUser)) {
      throw new NotFoundException('Tariff not found');
    }

    return this.buildTariffDto(tariff);
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
      include: tariffInclude,
    });

    return this.buildTariffDto(updatedTariff);
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

  async calculatePrice(tariffId: number, weight: number): Promise<number> {
    const tariff = await this.prismaService.tariff.findUnique({
      where: { id: tariffId },
    });

    if (!tariff || !tariff.isActive) {
      throw new NotFoundException('Tariff not found or inactive');
    }

    if (!tariff.isWeightBased) {
      return tariff.minimumPrice;
    }

    if (tariff.weightThreshold && weight <= tariff.weightThreshold) {
      return tariff.minimumPrice;
    }

    return parseFloat((weight * tariff.pricePerKg).toFixed(2));
  }
}
