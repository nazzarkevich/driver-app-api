import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ParcelType, Prisma, TariffPricingType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseTenantService } from 'src/common/base-tenant.service';
import { UserRequestType } from 'src/users/decorators/current-user.decorator';
import { CreateTariffDto } from './dtos/create-tariff.dto';
import { UpdateTariffDto } from './dtos/update-tariff.dto';
import { TariffDto } from './dtos/tariff.dto';
import {
  ParcelPriceOptionsDto,
  ParcelPriceOptionsResponseDto,
} from 'src/parcels/dtos/parcel-price-options.dto';

const tariffInclude = {
  business: { select: { currency: true } },
  tariffGroup: {
    include: {
      originCountry: true,
      destinationCountry: true,
    },
  },
} satisfies Prisma.TariffInclude;

type PricingTariff = Prisma.TariffGetPayload<{
  include: typeof tariffInclude;
}>;

@Injectable()
export class TariffsService extends BaseTenantService {
  constructor(prismaService: PrismaService) {
    super(prismaService);
  }

  private buildTariffDto(tariff: PricingTariff): TariffDto {
    return new TariffDto({
      ...tariff,
      currency: tariff.business.currency,
    } as any);
  }

  private async validateTariffGroup(
    tariffGroupId: number,
    user: UserRequestType,
  ): Promise<void> {
    const group = await this.prismaService.tariffGroup.findFirst({
      where: {
        id: tariffGroupId,
        businessId: user.businessId,
        isActive: true,
        isDeleted: false,
      },
    });
    if (!group) {
      throw new NotFoundException('Active tariff group not found');
    }
  }

  async create(
    user: UserRequestType,
    createTariffDto: CreateTariffDto,
  ): Promise<TariffDto> {
    await this.validateBusinessAccess(user.businessId, user);
    await this.validateTariffGroup(createTariffDto.tariffGroupId, user);

    const pricingType = createTariffDto.pricingType ?? TariffPricingType.Fixed;
    const tariff = await this.prismaService.tariff.create({
      data: {
        name: createTariffDto.name,
        description: createTariffDto.description,
        isActive: createTariffDto.isActive,
        tariffGroupId: createTariffDto.tariffGroupId,
        parcelType: createTariffDto.parcelType,
        minimumPrice: createTariffDto.minimumPrice,
        pricingType,
        pricePerKg:
          pricingType === TariffPricingType.Fixed
            ? null
            : createTariffDto.pricePerKg,
        weightThreshold:
          pricingType === TariffPricingType.Fixed
            ? null
            : createTariffDto.weightThreshold,
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
    const tariffs = await this.prismaService.tariff.findMany({
      where: this.getBusinessWhere(
        businessId,
        {
          ...(isActiveOnly && { isActive: true }),
          isDeleted: false,
        },
        currentUser,
      ),
      include: tariffInclude,
      orderBy: { createdAt: 'desc' },
    });
    return tariffs.map((tariff) => this.buildTariffDto(tariff));
  }

  async findOne(
    id: number,
    businessId: number,
    currentUser?: UserRequestType,
  ): Promise<TariffDto> {
    await this.validateBusinessAccess(businessId, currentUser);
    const tariff = await this.prismaService.tariff.findFirst({
      where: { id, isDeleted: false },
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
    const existingTariff = await this.prismaService.tariff.findFirst({
      where: { id, isDeleted: false },
    });
    if (
      !existingTariff ||
      !this.canAccessBusiness(existingTariff.businessId, currentUser)
    ) {
      throw new NotFoundException('Tariff not found');
    }
    if (updateTariffDto.tariffGroupId != null) {
      await this.validateTariffGroup(
        updateTariffDto.tariffGroupId,
        currentUser,
      );
    }

    const pricingType =
      updateTariffDto.pricingType ?? existingTariff.pricingType;
    const effectivePricePerKg =
      updateTariffDto.pricePerKg ?? existingTariff.pricePerKg;
    const data: Prisma.TariffUncheckedUpdateInput = {
      ...updateTariffDto,
      pricingType,
      ...(pricingType === TariffPricingType.Fixed
        ? { pricePerKg: null, weightThreshold: null }
        : {}),
    };
    if (
      pricingType === TariffPricingType.PerKg &&
      (effectivePricePerKg == null || Number(effectivePricePerKg) <= 0)
    ) {
      throw new BadRequestException(
        'pricePerKg must be greater than zero for per-kilogram tariffs',
      );
    }

    const updatedTariff = await this.prismaService.tariff.update({
      where: { id },
      data,
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
    const tariff = await this.prismaService.tariff.findFirst({
      where: { id, isDeleted: false },
    });
    if (!tariff || !this.canAccessBusiness(tariff.businessId, currentUser)) {
      throw new NotFoundException('Tariff not found');
    }
    await this.prismaService.tariff.update({
      where: { id },
      data: { isDeleted: true, isActive: false },
    });
  }

  calculateTariffAmount(
    tariff: Pick<
      PricingTariff,
      'pricingType' | 'minimumPrice' | 'pricePerKg' | 'weightThreshold'
    >,
    weight: number,
  ): number {
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new BadRequestException('Weight must be greater than zero');
    }
    const minimumPrice = new Prisma.Decimal(tariff.minimumPrice);
    if (tariff.pricingType === TariffPricingType.Fixed) {
      return Number(
        minimumPrice
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
          .toString(),
      );
    }
    if (tariff.pricePerKg == null || Number(tariff.pricePerKg) <= 0) {
      throw new BadRequestException('Per-kilogram tariff is misconfigured');
    }
    const threshold =
      tariff.weightThreshold == null ? null : Number(tariff.weightThreshold);
    if (threshold != null && weight <= threshold) {
      return Number(
        minimumPrice
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
          .toString(),
      );
    }
    const weightedPrice = new Prisma.Decimal(weight).times(tariff.pricePerKg!);
    return Number(
      Prisma.Decimal.max(minimumPrice, weightedPrice)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
        .toString(),
    );
  }

  async findEligibleTariff(
    user: UserRequestType,
    tariffId: number,
    originCountryId: number,
    destinationCountryId: number,
    parcelType: ParcelType,
    tx?: Prisma.TransactionClient,
  ): Promise<PricingTariff> {
    const client = tx ?? this.prismaService;
    const tariff = await client.tariff.findFirst({
      where: {
        id: tariffId,
        businessId: user.businessId,
        isActive: true,
        isDeleted: false,
        OR: [{ parcelType }, { parcelType: null }],
        tariffGroup: {
          businessId: user.businessId,
          isActive: true,
          isDeleted: false,
          originCountryId,
          destinationCountryId,
        },
      },
      include: tariffInclude,
    });
    if (!tariff) {
      throw new BadRequestException(
        'Selected tariff is not available for this parcel',
      );
    }
    return tariff;
  }

  async findPriceOptions(
    user: UserRequestType,
    dto: ParcelPriceOptionsDto,
  ): Promise<ParcelPriceOptionsResponseDto> {
    await this.validateBusinessAccess(user.businessId, user);
    const [business, tariffs] = await Promise.all([
      this.prismaService.business.findUniqueOrThrow({
        where: { id: user.businessId },
        select: { currency: true },
      }),
      this.prismaService.tariff.findMany({
        where: {
          businessId: user.businessId,
          isActive: true,
          isDeleted: false,
          OR: [{ parcelType: dto.parcelType }, { parcelType: null }],
          tariffGroup: {
            businessId: user.businessId,
            isActive: true,
            isDeleted: false,
            originCountryId: dto.originCountryId,
            destinationCountryId: dto.destinationCountryId,
          },
        },
        include: tariffInclude,
      }),
    ]);

    const options = tariffs
      .map((tariff) => ({
        tariffId: tariff.id,
        tariffName: tariff.name,
        tariffGroupId: tariff.tariffGroup!.id,
        tariffGroupName: tariff.tariffGroup!.name,
        pricingType: tariff.pricingType,
        pricePerKg:
          tariff.pricePerKg == null ? null : Number(tariff.pricePerKg),
        minimumPrice: Number(tariff.minimumPrice),
        calculatedPrice: this.calculateTariffAmount(tariff, dto.weight),
      }))
      .sort(
        (left, right) =>
          left.calculatedPrice - right.calculatedPrice ||
          left.tariffId - right.tariffId,
      );

    return { currency: business.currency, options };
  }
}
