import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BaseTenantService } from 'src/common/base-tenant.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserRequestType } from 'src/users/decorators/current-user.decorator';
import type { TariffListFilters } from 'src/tariffs/tariff-list-query';
import { CreateTariffGroupDto } from './dtos/create-tariff-group.dto';
import { TariffGroupDto } from './dtos/tariff-group.dto';
import { UpdateTariffGroupDto } from './dtos/update-tariff-group.dto';

const groupInclude = {
  originCountry: true,
  destinationCountry: true,
  _count: { select: { tariffs: { where: { isDeleted: false } } } },
} satisfies Prisma.TariffGroupInclude;
type GroupRecord = Prisma.TariffGroupGetPayload<{
  include: typeof groupInclude;
}>;
const routeConflict = () =>
  new ConflictException({
    code: 'TARIFF_GROUP_ROUTE_EXISTS',
    message: 'A group already reserves this direction',
  });

@Injectable()
export class TariffGroupsService extends BaseTenantService {
  constructor(prismaService: PrismaService) {
    super(prismaService);
  }
  private toDto(group: GroupRecord) {
    return new TariffGroupDto(group);
  }

  private async validateRoute(
    tx: Prisma.TransactionClient,
    businessId: number,
    originCountryId: number,
    destinationCountryId: number,
    excludedId?: number,
  ) {
    if (originCountryId === destinationCountryId)
      throw new BadRequestException({
        code: 'TARIFF_GROUP_INVALID_DIRECTION',
        message: 'Countries must differ',
      });
    if (
      (await tx.country.count({
        where: { id: { in: [originCountryId, destinationCountryId] } },
      })) !== 2
    )
      throw new BadRequestException({
        code: 'TARIFF_GROUP_INVALID_DIRECTION',
        message: 'Unknown country',
      });
    const duplicate = await tx.tariffGroup.findFirst({
      where: {
        businessId,
        originCountryId,
        destinationCountryId,
        isDeleted: false,
        ...(excludedId ? { id: { not: excludedId } } : {}),
      },
    });
    if (duplicate) throw routeConflict();
  }

  private async write<T>(
    action: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prismaService.$transaction(action);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2002') throw routeConflict();
          if (error.code === 'P2034') {
            if (attempt < 2) continue;
            throw new ConflictException({
              code: 'TARIFF_GROUP_WRITE_CONFLICT',
              message: 'Concurrent group modification',
            });
          }
        }
        throw error;
      }
    }
  }

  private async lockedGroup(
    tx: Prisma.TransactionClient,
    id: number,
    businessId: number,
  ) {
    // Serializes direction edits with updates and FK-backed tariff insertions.
    await tx.$queryRaw`SELECT "id" FROM "TariffGroup" WHERE "id" = ${id} AND "businessId" = ${businessId} AND "isDeleted" = false FOR UPDATE`;
    const group = await tx.tariffGroup.findFirst({
      where: { id, businessId, isDeleted: false },
      include: groupInclude,
    });
    if (!group) throw new NotFoundException('Tariff group not found');
    return group;
  }

  async create(
    user: UserRequestType,
    dto: CreateTariffGroupDto,
    businessId = user.businessId,
  ): Promise<TariffGroupDto> {
    await this.validateBusinessAccess(businessId, user);
    return this.write(async (tx) => {
      await this.validateRoute(
        tx,
        businessId,
        dto.originCountryId,
        dto.destinationCountryId,
      );
      const deleted = await tx.tariffGroup.findFirst({
        where: {
          businessId,
          originCountryId: dto.originCountryId,
          destinationCountryId: dto.destinationCountryId,
          isDeleted: true,
        },
      });
      const group = deleted
        ? await tx.tariffGroup.update({
            where: { id: deleted.id },
            data: {
              name: dto.name.trim(),
              isActive: dto.isActive ?? true,
              isDeleted: false,
            },
            include: groupInclude,
          })
        : await tx.tariffGroup.create({
            data: { ...dto, name: dto.name.trim(), businessId },
            include: groupInclude,
          });
      return this.toDto(group);
    });
  }

  async findAll(
    user: UserRequestType,
    businessId = user.businessId,
    filters: Pick<
      TariffListFilters,
      'page' | 'limit' | 'search' | 'isActive'
    > = {},
  ) {
    await this.validateBusinessAccess(businessId, user);
    const where: Prisma.TariffGroupWhereInput = {
      businessId,
      isDeleted: false,
      ...(filters.search
        ? { name: { contains: filters.search, mode: 'insensitive' } }
        : {}),
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
    };
    const orderBy: Prisma.TariffGroupOrderByWithRelationInput[] = [
      { createdAt: 'desc' },
      { id: 'desc' },
    ];
    if (filters.page === undefined) {
      return (
        await this.prismaService.tariffGroup.findMany({
          where,
          include: groupInclude,
          orderBy,
        })
      ).map((group) => this.toDto(group));
    }
    const limit = filters.limit ?? 20;
    const [groups, totalCount] = await this.prismaService.$transaction([
      this.prismaService.tariffGroup.findMany({
        where,
        include: groupInclude,
        orderBy,
        skip: (filters.page - 1) * limit,
        take: limit,
      }),
      this.prismaService.tariffGroup.count({ where }),
    ]);
    const pageCount = Math.ceil(totalCount / limit);
    return {
      items: groups.map((group) => this.toDto(group)),
      totalCount,
      currentPage: filters.page,
      pageCount,
      isFirstPage: filters.page === 1,
      isLastPage: filters.page >= pageCount,
      previousPage: filters.page > 1 ? filters.page - 1 : null,
      nextPage: filters.page < pageCount ? filters.page + 1 : null,
    };
  }

  async findOne(
    id: number,
    user: UserRequestType,
    businessId = user.businessId,
  ): Promise<TariffGroupDto> {
    await this.validateBusinessAccess(businessId, user);
    const group = await this.prismaService.tariffGroup.findFirst({
      where: { id, businessId, isDeleted: false },
      include: groupInclude,
    });
    if (!group) throw new NotFoundException('Tariff group not found');
    return this.toDto(group);
  }

  async update(
    id: number,
    user: UserRequestType,
    dto: UpdateTariffGroupDto,
    businessId = user.businessId,
  ): Promise<TariffGroupDto> {
    await this.validateBusinessAccess(businessId, user);
    return this.write(async (tx) => {
      const existing = await this.lockedGroup(tx, id, businessId);
      const origin = dto.originCountryId ?? existing.originCountryId;
      const destination =
        dto.destinationCountryId ?? existing.destinationCountryId;
      const directionChanged =
        origin !== existing.originCountryId ||
        destination !== existing.destinationCountryId;
      if (directionChanged && existing._count.tariffs > 0)
        throw new ConflictException({
          code: 'TARIFF_GROUP_DIRECTION_LOCKED',
          message: 'Groups with tariffs cannot change direction',
        });
      if (directionChanged)
        await this.validateRoute(tx, businessId, origin, destination, id);
      const group = await tx.tariffGroup.update({
        where: { id },
        data: {
          ...dto,
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        },
        include: groupInclude,
      });
      return this.toDto(group);
    });
  }

  async remove(
    id: number,
    user: UserRequestType,
    businessId = user.businessId,
  ): Promise<void> {
    await this.validateBusinessAccess(businessId, user);
    await this.write(async (tx) => {
      const group = await this.lockedGroup(tx, id, businessId);
      if (group._count.tariffs > 0)
        throw new ConflictException({
          code: 'TARIFF_GROUP_NOT_EMPTY',
          message: 'Group contains tariffs',
        });
      await tx.tariffGroup.update({
        where: { id },
        data: { isDeleted: true, isActive: false },
      });
    });
  }
}
