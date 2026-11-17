import { Prisma, UserType } from '@prisma/client';
import { CustomerActivityService } from './customer-activity.service';
import { CustomerActivityController } from './customer-activity.controller';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { ParcelsService } from 'src/parcels/parcels.service';
import type { PrismaService } from 'src/prisma/prisma.service';
import prismaWithPagination from 'src/prisma/prisma-client';
import { Permission } from 'src/permissions/permissions';
import { PERMISSIONS_KEY } from 'src/decorators/permissions.decorator';
const mockWithPages = jest.fn();
jest.mock('src/prisma/prisma-client', () => ({
  __esModule: true,
  default: {
    parcel: { paginate: jest.fn(() => ({ withPages: mockWithPages })) },
  },
}));
const user = {
  id: 7,
  businessId: 3,
  name: 'Staff',
  type: UserType.Manager,
  isAdmin: false,
  isSuperAdmin: false,
  iat: 0,
  exp: 9999999999,
};
function setup() {
  const tx = {
    parcel: {
      aggregate: jest
        .fn()
        .mockResolvedValue({
          _count: { id: 3 },
          _max: { createdAt: new Date('2026-11-01T10:00:00Z') },
        }),
      count: jest.fn().mockResolvedValue(2),
    },
    $queryRaw: jest.fn().mockResolvedValue([
      { currency: 'GBP', amount: new Prisma.Decimal('35.50') },
      { currency: 'UAH', amount: new Prisma.Decimal('1200') },
      { currency: null, amount: new Prisma.Decimal('12') },
    ]),
  };
  const prisma = {
    business: {
      findUnique: jest.fn().mockResolvedValue({ id: 3, isActive: true }),
    },
    customerProfile: { findFirst: jest.fn().mockResolvedValue({ id: 301 }) },
    $transaction: jest.fn(async (fn) => fn(tx)),
  };
  const parcels = { findAll: jest.fn().mockResolvedValue({ items: [] }) };
  const service = new CustomerActivityService(
    prisma as unknown as PrismaService,
    parcels as unknown as ParcelsService,
  );
  return { service, prisma, tx, parcels };
}
beforeEach(() => {
  jest.clearAllMocks();
  mockWithPages.mockResolvedValue([[], { currentPage: 1 }]);
});
describe('customer read activity', () => {
  it('summarizes unique parcels and preserves separate decimal totals per currency', async () => {
    const { service, tx, prisma } = setup();
    const summary = await service.getSummary(301, 3, user);
    expect(prisma.customerProfile.findFirst).toHaveBeenCalledWith({
      where: { id: 301, businessId: 3, isDeleted: false },
      select: { id: true },
    });
    expect(tx.parcel.aggregate).toHaveBeenCalledWith({
      where: {
        businessId: 3,
        isDeleted: false,
        OR: [{ senderId: 301 }, { recipientId: 301 }],
      },
      _count: { id: true },
      _max: { createdAt: true },
    });
    expect(summary).toMatchObject({
      totalParcelCount: 3,
      sentParcelCount: 2,
      receivedParcelCount: 2,
      paidTotals: [
        { currency: 'GBP', amount: '35.50' },
        { currency: 'UAH', amount: '1200.00' },
        { currency: null, amount: '12.00' },
      ],
    });
    const sql = tx.$queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(sql.values).toEqual([3, 301, 301]);
    expect(sql.sql).toContain('SUM(p."price")');
    expect(sql.sql).toContain('p."paymentStatus" = \'Paid\'');
    expect(sql.sql).toContain('p."paidBy" = \'Sender\'');
    expect(sql.sql).toContain('p."paidBy" = \'Recipient\'');
    expect(sql.sql).toContain('price."currency"');
    expect(sql.sql).toContain('p."isDeleted" = false');
  });
  it('returns empty statistics without assuming a payment currency', async () => {
    const { service, tx } = setup();
    tx.parcel.aggregate.mockResolvedValue({
      _count: { id: 0 },
      _max: { createdAt: null },
    });
    tx.parcel.count.mockResolvedValue(0);
    tx.$queryRaw.mockResolvedValue([]);
    expect(await service.getSummary(301, 3, user)).toEqual({
      totalParcelCount: 0,
      sentParcelCount: 0,
      receivedParcelCount: 0,
      latestParcelAt: null,
      paidTotals: [],
    });
  });
  it('rejects foreign scopes and missing/deleted customers before reading parcels', async () => {
    const { service, prisma, tx } = setup();
    await expect(service.getSummary(301, 9, user)).rejects.toThrow(
      'Access denied',
    );
    expect(tx.parcel.aggregate).not.toHaveBeenCalled();
    prisma.customerProfile.findFirst.mockResolvedValue(null);
    await expect(service.getSummary(301, 3, user)).rejects.toThrow(
      'Customer profile not found',
    );
    expect(tx.parcel.aggregate).not.toHaveBeenCalled();
  });
  it('forwards combined customer filtering to the existing parcel reader', async () => {
    const { service, parcels } = setup();
    await service.getParcels(301, 3, user, 2);
    const args = parcels.findAll.mock.calls[0];
    expect(args.slice(0, 3)).toEqual([3, user, 2]);
    expect(args[17]).toBe(301);
    expect(args[5]).toBeUndefined();
    expect(args[6]).toBeUndefined();
  });
  it('paginates one OR query, excludes deleted parcels, and uses a stable tie-break order', async () => {
    const { prisma } = setup();
    const reader = new ParcelsService(
      prisma as unknown as PrismaService,
      {} as never,
      {} as never,
      {} as never,
    );
    await reader.findAll(
      3,
      user,
      2,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      301,
    );
    const args = (prismaWithPagination.parcel.paginate as jest.Mock).mock
      .calls[0][0];
    expect(args.where).toMatchObject({
      businessId: 3,
      AND: [
        { isDeleted: false, OR: [{ senderId: 301 }, { recipientId: 301 }] },
      ],
    });
    expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    expect(mockWithPages).toHaveBeenCalledWith({ page: 2 });
  });
  it('honors superadmin scope on summary and parcel controllers', async () => {
    const summary = jest.fn();
    const parcels = jest.fn();
    const controller = new CustomerActivityController({
      getSummary: summary,
      getParcels: parcels,
    } as unknown as CustomerActivityService);
    const admin = { ...user, isSuperAdmin: true };
    controller.summary(admin, 301, '9');
    controller.parcels(admin, 301, 2, '9');
    expect(summary).toHaveBeenCalledWith(301, 9, admin);
    expect(parcels).toHaveBeenCalledWith(301, 9, admin, 2);
    expect(() => controller.summary(user, 301, '9')).toThrow(
      'Cannot access another business',
    );
    expect(() => controller.parcels(user, 301, 0)).toThrow('Invalid page');
  });
  it('requires both customer and parcel read permissions on activity endpoints', () => {
    for (const method of ['summary', 'parcels'])
      expect(
        Reflect.getMetadata(
          PERMISSIONS_KEY,
          CustomerActivityController.prototype[method],
        ),
      ).toEqual([Permission.CUSTOMER_READ, Permission.PARCEL_READ]);
  });
  it('forwards selected business scope to existing customer detail and notes reads', async () => {
    const findOne = jest.fn();
    const getNotes = jest.fn();
    const controller = new CustomersController({
      findOne,
      getNotes,
    } as unknown as CustomersService);
    const admin = { ...user, isSuperAdmin: true };
    await controller.findCustomer(admin, 301, '9');
    controller.getNotes(admin, 301, '9');
    expect(findOne).toHaveBeenCalledWith(301, 9, admin);
    expect(getNotes).toHaveBeenCalledWith(301, 9, admin);
  });
});
