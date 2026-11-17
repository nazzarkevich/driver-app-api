import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  type ExecutionContext,
} from '@nestjs/common';
import { Prisma, UserType } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TariffGroupsService } from './tariff-groups.service';
import { TariffGroupsController } from './tariff-groups.controller';
import { CreateTariffGroupDto } from './dtos/create-tariff-group.dto';
import { UpdateTariffGroupDto } from './dtos/update-tariff-group.dto';
import { PermissionsGuard } from 'src/guards/permissions.guard';
const user = {
  id: 1,
  businessId: 3,
  type: UserType.Manager,
  isAdmin: false,
  isSuperAdmin: false,
  name: 'Manager',
  iat: 1,
  exp: 2,
};
const group = {
  id: 7,
  businessId: 3,
  name: 'UK to UA',
  originCountryId: 2,
  destinationCountryId: 1,
  isActive: true,
  isDeleted: false,
  originCountry: { id: 2, name: 'United Kingdom', isoCode: 'GB' },
  destinationCountry: { id: 1, name: 'Ukraine', isoCode: 'UA' },
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { tariffs: 0 },
};
const dto = { name: 'Group', originCountryId: 2, destinationCountryId: 1 };
function setup() {
  const prisma = {
    business: {
      findUnique: jest.fn().mockResolvedValue({ id: 3, isActive: true }),
    },
    country: { count: jest.fn().mockResolvedValue(2) },
    tariffGroup: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([group]),
      count: jest.fn().mockResolvedValue(21),
      create: jest.fn().mockResolvedValue(group),
      update: jest.fn().mockResolvedValue(group),
    },
    parcelPrice: { updateMany: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([{ id: 7 }]),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((input) =>
    typeof input === 'function' ? input(prisma) : Promise.all(input),
  );
  const service = new TariffGroupsService(prisma as any);
  return { prisma, service, controller: new TariffGroupsController(service) };
}
describe('tariff-group web API', () => {
  it('keeps legacy arrays and returns scoped paginated records with matching counts', async () => {
    const { service, prisma } = setup();
    expect(Array.isArray(await service.findAll(user))).toBe(true);
    expect(prisma.tariffGroup.count).not.toHaveBeenCalled();
    const page = await service.findAll(user, 3, {
      page: 2,
      search: 'Group',
      isActive: false,
    });
    expect(page).toMatchObject({
      currentPage: 2,
      totalCount: 21,
      pageCount: 2,
      previousPage: 1,
      nextPage: null,
    });
    expect(prisma.tariffGroup.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20,
        where: {
          businessId: 3,
          isDeleted: false,
          isActive: false,
          name: { contains: 'Group', mode: 'insensitive' },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(prisma.tariffGroup.count.mock.calls[0][0].where).toEqual(
      prisma.tariffGroup.findMany.mock.calls[1][0].where,
    );
  });
  it('enforces selected business scope for list, detail and creation', async () => {
    const { controller, prisma } = setup();
    expect(() => controller.findAll(user, { businessId: '4' })).toThrow(
      ForbiddenException,
    );
    const admin = { ...user, isSuperAdmin: true };
    await controller.findAll(admin, { businessId: '4' });
    expect(prisma.tariffGroup.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { businessId: 4, isDeleted: false } }),
    );
    prisma.tariffGroup.findFirst.mockResolvedValueOnce({
      ...group,
      businessId: 4,
    });
    await controller.findOne(admin, 7, '4');
    expect(prisma.tariffGroup.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: 7, businessId: 4, isDeleted: false },
      }),
    );
    await controller.create(admin, dto, '4');
    expect(prisma.tariffGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ businessId: 4 }),
      }),
    );
  });
  it('does not return records outside the current scope', async () => {
    const { service, prisma } = setup();
    await expect(service.findOne(7, user)).rejects.toThrow(NotFoundException);
    expect(prisma.tariffGroup.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7, businessId: 3, isDeleted: false },
      }),
    );
  });
  it.each([
    { page: '0' },
    { page: '1.5' },
    { limit: '101' },
    { isActive: 'yes' },
  ])('rejects invalid query %j', (query) => {
    const { controller } = setup();
    expect(() => controller.findAll(user, query)).toThrow(BadRequestException);
  });
  it('rejects identical or unknown countries', async () => {
    const { service, prisma } = setup();
    await expect(
      service.create(user, { ...dto, destinationCountryId: 2 }),
    ).rejects.toThrow(BadRequestException);
    prisma.country.count.mockResolvedValue(1);
    await expect(service.create(user, dto)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.tariffGroup.create).not.toHaveBeenCalled();
  });
  it('treats inactive directional pairs as reserved but permits the reverse pair', async () => {
    const { service, prisma } = setup();
    prisma.tariffGroup.findFirst.mockResolvedValueOnce({
      ...group,
      isActive: false,
    });
    await expect(service.create(user, dto)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TARIFF_GROUP_ROUTE_EXISTS' }),
    });
    await service.create(user, {
      ...dto,
      originCountryId: 1,
      destinationCountryId: 2,
    });
    expect(prisma.tariffGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          originCountryId: 1,
          destinationCountryId: 2,
        }),
      }),
    );
  });
  it('restores a deleted group for the same direction', async () => {
    const { service, prisma } = setup();
    prisma.tariffGroup.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...group, isDeleted: true });
    await service.create(user, dto);
    expect(prisma.tariffGroup.create).not.toHaveBeenCalled();
    expect(prisma.tariffGroup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: { name: 'Group', isActive: true, isDeleted: false },
      }),
    );
  });
  it('locks the group row before reading the latest tariff count and rejects populated direction changes', async () => {
    const { service, prisma } = setup();
    // The editor may have loaded a count of zero before another user added a tariff.
    prisma.tariffGroup.findFirst.mockResolvedValueOnce({
      ...group,
      _count: { tariffs: 1 },
    });
    await expect(
      service.update(7, user, { originCountryId: 1, destinationCountryId: 2 }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'TARIFF_GROUP_DIRECTION_LOCKED',
      }),
    });
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.tariffGroup.findFirst.mock.invocationCallOrder[0],
    );
    expect(prisma.tariffGroup.update).not.toHaveBeenCalled();
  });
  it('allows populated groups to change name/status without changing tariff snapshots', async () => {
    const { service, prisma } = setup();
    prisma.tariffGroup.findFirst.mockResolvedValueOnce({
      ...group,
      _count: { tariffs: 5 },
    });
    await service.update(7, user, {
      name: 'Renamed',
      isActive: false,
      originCountryId: 2,
      destinationCountryId: 1,
    });
    expect(prisma.tariffGroup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Renamed', isActive: false }),
      }),
    );
    expect(prisma.parcelPrice.updateMany).not.toHaveBeenCalled();
  });
  it('allows an empty group direction change without merging a group occupying the target pair', async () => {
    const { service, prisma } = setup();
    prisma.tariffGroup.findFirst
      .mockResolvedValueOnce(group)
      .mockResolvedValueOnce(null);
    await service.update(7, user, {
      originCountryId: 1,
      destinationCountryId: 2,
    });
    expect(prisma.tariffGroup.update).toHaveBeenCalled();
    prisma.tariffGroup.findFirst
      .mockResolvedValueOnce(group)
      .mockResolvedValueOnce({ ...group, id: 8 });
    await expect(
      service.update(7, user, { originCountryId: 1, destinationCountryId: 2 }),
    ).rejects.toThrow(ConflictException);
  });
  it('maps database uniqueness races to a direction conflict', async () => {
    const { service, prisma } = setup();
    prisma.tariffGroup.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(service.create(user, dto)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TARIFF_GROUP_ROUTE_EXISTS' }),
    });
  });
  it('validates trimmed names, positive country IDs and update nulls', async () => {
    const value = plainToInstance(CreateTariffGroupDto, {
      ...dto,
      name: ' Group ',
    });
    expect(value.name).toBe('Group');
    expect(await validate(value)).toHaveLength(0);
    for (const change of [
      { name: ' ' },
      { originCountryId: 0 },
      { destinationCountryId: 1.5 },
    ])
      expect(
        (
          await validate(
            plainToInstance(CreateTariffGroupDto, { ...dto, ...change }),
          )
        ).length,
      ).toBeGreaterThan(0);
    for (const change of [
      { name: null },
      { originCountryId: null },
      { isActive: null },
    ])
      expect(
        (await validate(plainToInstance(UpdateTariffGroupDto, change))).length,
      ).toBeGreaterThan(0);
  });
  it.each([
    UserType.InternationalDriver,
    UserType.ParcelCourier,
    UserType.Manager,
    UserType.Moderator,
  ])('enforces read/write permissions for %s', (type) => {
    const guard = new PermissionsGuard(new Reflector());
    const context = (handler: (...args: never[]) => unknown, admin = false) =>
      ({
        getHandler: () => handler,
        getClass: () => TariffGroupsController,
        switchToHttp: () => ({
          getRequest: () => ({
            currentUser: { ...user, type, isAdmin: admin },
          }),
        }),
      }) as unknown as ExecutionContext;
    expect(
      guard.canActivate(context(TariffGroupsController.prototype.findAll)),
    ).toBe(true);
    for (const handler of [
      TariffGroupsController.prototype.create,
      TariffGroupsController.prototype.update,
      TariffGroupsController.prototype.remove,
    ]) {
      expect(guard.canActivate(context(handler))).toBe(
        type === UserType.Manager || type === UserType.Moderator,
      );
      expect(guard.canActivate(context(handler, true))).toBe(true);
    }
  });
});
