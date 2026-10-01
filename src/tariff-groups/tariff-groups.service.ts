import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BaseTenantService } from 'src/common/base-tenant.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserRequestType } from 'src/users/decorators/current-user.decorator';
import { CreateTariffGroupDto } from './dtos/create-tariff-group.dto';
import { TariffGroupDto } from './dtos/tariff-group.dto';
import { UpdateTariffGroupDto } from './dtos/update-tariff-group.dto';

const tariffGroupInclude = {
  originCountry: true,
  destinationCountry: true,
  _count: { select: { tariffs: { where: { isDeleted: false } } } },
};

@Injectable()
export class TariffGroupsService extends BaseTenantService {
  constructor(prismaService: PrismaService) {
    super(prismaService);
  }

  private toDto(group: any): TariffGroupDto {
    return new TariffGroupDto(group);
  }

  private async validateRoute(
    businessId: number,
    originCountryId: number,
    destinationCountryId: number,
    excludedGroupId?: number,
  ): Promise<void> {
    if (originCountryId === destinationCountryId) {
      throw new BadRequestException('Origin and destination countries must differ');
    }

    const countryCount = await this.prismaService.country.count({
      where: { id: { in: [originCountryId, destinationCountryId] } },
    });
    if (countryCount !== 2) {
      throw new BadRequestException('Origin or destination country does not exist');
    }

    const duplicate = await this.prismaService.tariffGroup.findFirst({
      where: {
        businessId,
        originCountryId,
        destinationCountryId,
        isDeleted: false,
        ...(excludedGroupId ? { id: { not: excludedGroupId } } : {}),
      },
    });
    if (duplicate) {
      throw new ConflictException('A tariff group already exists for this route');
    }
  }

  async create(
    user: UserRequestType,
    dto: CreateTariffGroupDto,
  ): Promise<TariffGroupDto> {
    await this.validateBusinessAccess(user.businessId, user);
    await this.validateRoute(
      user.businessId,
      dto.originCountryId,
      dto.destinationCountryId,
    );

    const deletedGroup = await this.prismaService.tariffGroup.findFirst({
      where: {
        businessId: user.businessId,
        originCountryId: dto.originCountryId,
        destinationCountryId: dto.destinationCountryId,
        isDeleted: true,
      },
    });
    if (deletedGroup) {
      const restored = await this.prismaService.tariffGroup.update({
        where: { id: deletedGroup.id },
        data: {
          name: dto.name.trim(),
          isActive: dto.isActive ?? true,
          isDeleted: false,
        },
        include: tariffGroupInclude,
      });
      return this.toDto(restored);
    }

    const group = await this.prismaService.tariffGroup.create({
      data: { ...dto, name: dto.name.trim(), businessId: user.businessId },
      include: tariffGroupInclude,
    });
    return this.toDto(group);
  }

  async findAll(user: UserRequestType): Promise<TariffGroupDto[]> {
    await this.validateBusinessAccess(user.businessId, user);
    const groups = await this.prismaService.tariffGroup.findMany({
      where: this.getBusinessWhere(
        user.businessId,
        { isDeleted: false },
        user,
      ),
      include: tariffGroupInclude,
      orderBy: { createdAt: 'desc' },
    });
    return groups.map((group) => this.toDto(group));
  }

  async findOne(id: number, user: UserRequestType): Promise<TariffGroupDto> {
    await this.validateBusinessAccess(user.businessId, user);
    const group = await this.prismaService.tariffGroup.findUnique({
      where: { id },
      include: tariffGroupInclude,
    });
    if (
      !group ||
      group.isDeleted ||
      !this.canAccessBusiness(group.businessId, user)
    ) {
      throw new NotFoundException('Tariff group not found');
    }
    return this.toDto(group);
  }

  async update(
    id: number,
    user: UserRequestType,
    dto: UpdateTariffGroupDto,
  ): Promise<TariffGroupDto> {
    const existing = await this.findOne(id, user);
    const originCountryId = dto.originCountryId ?? existing.originCountryId;
    const destinationCountryId =
      dto.destinationCountryId ?? existing.destinationCountryId;
    await this.validateRoute(
      user.businessId,
      originCountryId,
      destinationCountryId,
      id,
    );

    const group = await this.prismaService.tariffGroup.update({
      where: { id },
      data: { ...dto, ...(dto.name ? { name: dto.name.trim() } : {}) },
      include: tariffGroupInclude,
    });
    return this.toDto(group);
  }

  async remove(id: number, user: UserRequestType): Promise<void> {
    const group = await this.findOne(id, user);
    if (group.tariffsCount > 0) {
      throw new ConflictException(
        'A tariff group containing tariffs cannot be deleted',
      );
    }
    await this.prismaService.tariffGroup.update({
      where: { id },
      data: { isDeleted: true, isActive: false },
    });
  }
}
