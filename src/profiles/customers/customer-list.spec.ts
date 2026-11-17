import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserType } from '@prisma/client';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import prismaWithPagination from 'src/prisma/prisma-client';
import type { PrismaService } from 'src/prisma/prisma.service';
import type { AuditService } from 'src/audit/audit.service';
import type { SupabaseService } from 'src/supabase/supabase.service';
const mockWithPages = jest.fn();
jest.mock('src/prisma/prisma-client', () => ({
  __esModule: true,
  default: {
    customerProfile: {
      paginate: jest.fn(() => ({ withPages: mockWithPages })),
    },
  },
}));
const user = {
  id: 7,
  businessId: 3,
  type: UserType.Manager,
  isAdmin: false,
  isSuperAdmin: false,
  name: 'Test',
  iat: 0,
  exp: 9999999999,
};
function setup(isoCode = 'UA') {
  const prisma = {
    business: {
      findUnique: jest.fn().mockResolvedValue({ id: 3, isActive: true }),
    },
    country: { findUnique: jest.fn().mockResolvedValue({ isoCode }) },
    customerProfile: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return {
    service: new CustomersService(
      prisma as unknown as PrismaService,
      {} as AuditService,
      {} as SupabaseService,
    ),
    prisma,
  };
}
const where = () =>
  (prismaWithPagination.customerProfile.paginate as jest.Mock).mock.calls[0][0]
    .where;
beforeEach(() => {
  jest.clearAllMocks();
  mockWithPages.mockResolvedValue([[], { currentPage: 1 }]);
});
describe('customer registry', () => {
  it('matches Ukraine using any active regular address or active Nova Post branch before pagination', async () => {
    const { service, prisma } = setup();
    await service.findAll(3, 2, 'Іван', undefined, 47, undefined, user);
    expect(prisma.country.findUnique).toHaveBeenCalledWith({
      where: { id: 47 },
      select: { isoCode: true },
    });
    expect(where()).toMatchObject({
      businessId: 3,
      isDeleted: false,
      AND: [
        { OR: expect.any(Array) },
        {
          OR: [
            {
              addresses: {
                some: { countryId: 47, isActive: true, isDeleted: false },
              },
            },
            { novaPostAddresses: { some: { warehouse: { isActive: true } } } },
          ],
        },
      ],
    });
    expect(mockWithPages).toHaveBeenCalledWith({ page: 2 });
    expect(JSON.stringify(where())).not.toContain('isPrimary');
    expect(JSON.stringify(where())).not.toContain('isBlocked');
  });
  it('matches GB through active regular addresses without including Nova Post-only customers', async () => {
    const { service } = setup('GB');
    await service.findAll(3, 1, undefined, undefined, 92, undefined, user);
    expect(where().AND).toEqual([
      {
        addresses: {
          some: { countryId: 92, isActive: true, isDeleted: false },
        },
      },
    ]);
  });
  it('keeps the tablet array response and excludes deleted profiles without active/blocked defaults', async () => {
    const { service, prisma } = setup();
    expect(await service.findAll(3, undefined, 'Олена')).toEqual([]);
    expect(prisma.customerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          businessId: 3,
          isDeleted: false,
          AND: [{ OR: expect.any(Array) }],
        },
      }),
    );
  });
  it('rejects a direct service attempt to read another business as ordinary staff', async () => {
    const { service } = setup();
    await expect(
      service.findAll(9, 1, undefined, undefined, undefined, undefined, user),
    ).rejects.toThrow('Access denied');
  });
  it('allows a superadmin to read the chosen business', async () => {
    const { service } = setup();
    await service.findAll(9, 1, undefined, undefined, undefined, undefined, {
      ...user,
      isSuperAdmin: true,
    });
    expect(where()).toEqual({ businessId: 9, isDeleted: false });
  });
  it('forwards valid filters and the superadmin business override from the controller', async () => {
    const findAll = jest.fn().mockResolvedValue({ items: [] });
    const controller = new CustomersController({
      findAll,
    } as unknown as CustomersService);
    const admin = { ...user, isSuperAdmin: true };
    await controller.findAllCustomers(
      admin,
      '2',
      'Олена',
      undefined,
      '47',
      undefined,
      '9',
    );
    expect(findAll).toHaveBeenCalledWith(
      9,
      2,
      'Олена',
      undefined,
      47,
      undefined,
      admin,
    );
  });
  it('defaults tablet requests to the authenticated business', async () => {
    const findAll = jest.fn().mockResolvedValue([]);
    await new CustomersController({
      findAll,
    } as unknown as CustomersService).findAllCustomers(user);
    expect(findAll).toHaveBeenCalledWith(
      3,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      user,
    );
  });
  it('rejects an ordinary staff business override', async () => {
    await expect(
      new CustomersController({} as CustomersService).findAllCustomers(
        user,
        '1',
        undefined,
        undefined,
        undefined,
        undefined,
        '9',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it.each(['0', '-1', '1.2', 'abc', '', '9007199254740992'])(
    'rejects an invalid business override: %s',
    async (businessId) => {
      await expect(
        new CustomersController({} as CustomersService).findAllCustomers(
          { ...user, isSuperAdmin: true },
          '1',
          undefined,
          undefined,
          undefined,
          undefined,
          businessId,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});
