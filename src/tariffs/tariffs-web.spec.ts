import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserType, TariffPricingType } from '@prisma/client';
import { TariffsController } from './tariffs.controller';
import { TariffsService } from './tariffs.service';
import { parseTariffListQuery } from './tariff-list-query';
import { CreateTariffDto } from './dtos/create-tariff.dto';
import { UpdateTariffDto } from './dtos/update-tariff.dto';
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
const tariff = {
  id: 9,
  name: 'Standard',
  description: '',
  businessId: 3,
  isDeleted: false,
  isActive: true,
  tariffGroupId: 7,
  tariffGroup: null,
  business: { currency: 'GBP' },
  parcelType: null,
  pricingType: TariffPricingType.PerKg,
  minimumPrice: 10,
  pricePerKg: 2,
  weightThreshold: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
};
function setup() {
  const prisma = {
    business: {
      findUnique: jest.fn().mockResolvedValue({ id: 3, isActive: true }),
    },
    tariffGroup: {
      findFirst: jest.fn().mockResolvedValue({ id: 7, isActive: true }),
    },
    tariff: {
      findMany: jest.fn().mockResolvedValue([tariff]),
      count: jest.fn().mockResolvedValue(21),
      findFirst: jest.fn().mockResolvedValue(tariff),
      create: jest.fn().mockResolvedValue(tariff),
      update: jest.fn().mockResolvedValue(tariff),
    },
    $transaction: jest.fn((queries) => Promise.all(queries)),
  };
  return { prisma, service: new TariffsService(prisma as any) };
}
describe('tariff web API', () => {
  it('retains legacy array and activeOnly behavior', async () => {
    const { service, prisma } = setup();
    expect(Array.isArray(await service.findAll(3, user))).toBe(true);
    await service.findAll(
      3,
      user,
      parseTariffListQuery({ activeOnly: 'true' }),
    );
    expect(prisma.tariff.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { businessId: 3, isDeleted: false, isActive: true },
      }),
    );
    expect(prisma.tariff.count).not.toHaveBeenCalled();
  });
  it('filters and paginates using the same scoped predicate and stable order', async () => {
    const { service, prisma } = setup();
    const result = await service.findAll(
      3,
      user,
      parseTariffListQuery({
        page: '2',
        search: ' Stan ',
        tariffGroupId: '7',
        isActive: 'false',
      }),
    );
    expect(result).toMatchObject({
      currentPage: 2,
      totalCount: 21,
      pageCount: 2,
      previousPage: 1,
      nextPage: null,
      isLastPage: true,
    });
    expect(prisma.tariff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        where: {
          businessId: 3,
          isDeleted: false,
          isActive: false,
          tariffGroupId: 7,
          name: { contains: 'Stan', mode: 'insensitive' },
        },
      }),
    );
    expect(prisma.tariff.count.mock.calls[0][0].where).toEqual(
      prisma.tariff.findMany.mock.calls[0][0].where,
    );
  });
  it.each([
    { page: '0' },
    { page: '1.2' },
    { limit: '101' },
    { tariffGroupId: '-1' },
    { isActive: 'yes' },
    { activeOnly: '1' },
  ])('rejects invalid list input %j', (query) => {
    expect(() => parseTariffListQuery(query)).toThrow(BadRequestException);
  });
  it('rejects business overrides for staff and scopes superadmin reads/writes to the selected business', async () => {
    const { service, prisma } = setup();
    const controller = new TariffsController(service);
    expect(() => controller.findAll(user, { businessId: '4' })).toThrow(
      ForbiddenException,
    );
    const admin = { ...user, isSuperAdmin: true };
    await controller.findAll(admin, { businessId: '4' });
    expect(prisma.tariff.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { businessId: 4, isDeleted: false } }),
    );
    await controller.findOne(admin, 9, '4');
    expect(prisma.tariff.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: 9, businessId: 4, isDeleted: false },
      }),
    );
    await controller.create(
      admin,
      { name: 'Scoped', tariffGroupId: 7, minimumPrice: 10 },
      '4',
    );
    expect(prisma.tariffGroup.findFirst).toHaveBeenLastCalledWith({
      where: { id: 7, businessId: 4, isActive: true, isDeleted: false },
    });
    expect(prisma.tariff.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ businessId: 4 }),
      }),
    );
  });
  it('requires an active group for new tariffs or reassignment', async () => {
    const { service, prisma } = setup();
    prisma.tariffGroup.findFirst.mockResolvedValue(null);
    await expect(
      service.create(user, { name: 'New', tariffGroupId: 8, minimumPrice: 10 }),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.update(9, 3, { tariffGroupId: 8 }, user),
    ).rejects.toThrow(NotFoundException);
  });
  it('retains an unchanged inactive group and explicitly clears thresholds', async () => {
    const { service, prisma } = setup();
    await service.update(
      9,
      3,
      { name: 'Edited', tariffGroupId: 7, weightThreshold: null },
      user,
    );
    expect(prisma.tariffGroup.findFirst).not.toHaveBeenCalled();
    expect(prisma.tariff.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          weightThreshold: null,
          name: 'Edited',
        }),
      }),
    );
  });
  it('clears kg fields for fixed pricing and rejects an absent effective kg rate', async () => {
    const { service, prisma } = setup();
    await service.update(9, 3, { pricingType: 'Fixed' }, user);
    expect(prisma.tariff.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pricePerKg: null,
          weightThreshold: null,
        }),
      }),
    );
    await expect(
      service.update(9, 3, { pricingType: 'PerKg', pricePerKg: null }, user),
    ).rejects.toThrow(BadRequestException);
  });
  it('validates decimal precision, trimmed names, and nullable update thresholds', async () => {
    const base = {
      name: ' Standard ',
      tariffGroupId: 7,
      minimumPrice: 1.25,
      pricingType: 'PerKg',
      pricePerKg: 0.01,
      weightThreshold: 1.125,
    };
    const dto = plainToInstance(CreateTariffDto, base);
    expect(dto.name).toBe('Standard');
    expect(await validate(dto)).toHaveLength(0);
    for (const change of [
      { name: ' ' },
      { minimumPrice: -1 },
      { minimumPrice: 1.234 },
      { pricePerKg: 0 },
      { pricePerKg: 1.234 },
      { weightThreshold: 1.1234 },
    ]) {
      expect(
        (
          await validate(
            plainToInstance(CreateTariffDto, { ...base, ...change }),
          )
        ).length,
      ).toBeGreaterThan(0);
    }
    expect(
      await validate(
        plainToInstance(UpdateTariffDto, { weightThreshold: null }),
      ),
    ).toHaveLength(0);
    expect(
      (await validate(plainToInstance(UpdateTariffDto, { pricePerKg: -2 })))
        .length,
    ).toBeGreaterThan(0);
  });
  it('preserves fixed/minimum/threshold price semantics', () => {
    const { service } = setup();
    expect(service.calculateTariffAmount(tariff as any, 5)).toBe(10);
    expect(service.calculateTariffAmount(tariff as any, 6)).toBe(12);
    expect(
      service.calculateTariffAmount(
        { ...tariff, pricingType: TariffPricingType.Fixed } as any,
        20,
      ),
    ).toBe(10);
  });
  it.each([
    UserType.InternationalDriver,
    UserType.ParcelCourier,
    UserType.Manager,
    UserType.Moderator,
  ])('enforces read/write permissions for %s', (type) => {
    const guard = new PermissionsGuard(new Reflector());
    const context = (handler: Function, account = { ...user, type }) =>
      ({
        getHandler: () => handler,
        getClass: () => TariffsController,
        switchToHttp: () => ({ getRequest: () => ({ currentUser: account }) }),
      }) as unknown as ExecutionContext;
    expect(
      guard.canActivate(context(TariffsController.prototype.findAll)),
    ).toBe(true);
    const manage = type === UserType.Manager || type === UserType.Moderator;
    for (const handler of [
      TariffsController.prototype.create,
      TariffsController.prototype.update,
      TariffsController.prototype.remove,
    ]) {
      expect(guard.canActivate(context(handler))).toBe(manage);
      expect(
        guard.canActivate(context(handler, { ...user, type, isAdmin: true })),
      ).toBe(true);
    }
  });
});
