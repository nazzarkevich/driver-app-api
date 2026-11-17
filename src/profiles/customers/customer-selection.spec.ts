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
function setup() {
  const prisma = {
    business: {
      findUnique: jest.fn().mockResolvedValue({ id: 3, isActive: true }),
    },
    customerProfile: {
      findFirst: jest.fn().mockResolvedValue({ id: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    parcel: { groupBy: jest.fn().mockResolvedValue([]) },
  };
  const service = new CustomersService(
    prisma as unknown as PrismaService,
    {} as AuditService,
    {} as SupabaseService,
  );
  return { service, prisma };
}
beforeEach(() => {
  jest.clearAllMocks();
  mockWithPages.mockResolvedValue([[], { currentPage: 1 }]);
});
const where = () =>
  (prismaWithPagination.customerProfile.paginate as jest.Mock).mock.calls[0][0]
    .where;
describe('customer selection', () => {
  it.each(['Олена', 'КОВАЛЬ'])(
    'searches first and last names case-insensitively: %s',
    async (term) => {
      const { service } = setup();
      await service.findAll(3, 2, ` ${term} `, false, undefined, true);
      expect(where()).toMatchObject({
        businessId: 3,
        AND: [
          {
            OR: [
              { firstName: { contains: term, mode: 'insensitive' } },
              { lastName: { contains: term, mode: 'insensitive' } },
            ],
          },
          { OR: [{ user: null }, { user: { isBlocked: false } }] },
          { isActive: true },
        ],
      });
      expect(mockWithPages).toHaveBeenCalledWith({ page: 2 });
    },
  );
  it.each(['+44 (7911) 123-456', '0044 7911 123456'])(
    'matches phone punctuation and separate country prefix: %s',
    async (term) => {
      const { service } = setup();
      await service.findAll(3, 1, term, false, undefined, true);
      expect(where().AND[0].OR).toContainEqual({
        phoneNumber: {
          countryCode: { in: ['44', '+44'] },
          number: { contains: '7911123456' },
        },
      });
    },
  );
  it('keeps blocked-only queries distinct from eligible linked and unlinked customers', async () => {
    const { service } = setup();
    await service.findAll(3, 1, undefined, true);
    expect(where().AND).toEqual([{ user: { isBlocked: true } }]);
  });
  it('returns empty suggestions without fetching candidates when no history exists', async () => {
    const { service, prisma } = setup();
    expect(await service.getRecipientSuggestions(1, 3)).toEqual([]);
    expect(prisma.customerProfile.findMany).not.toHaveBeenCalled();
  });
  it('filters eligible counterparts, combines both relationship directions and ranks before limiting to three', async () => {
    const { service, prisma } = setup();
    const date = new Date('2026-11-01T10:00:00Z');
    prisma.parcel.groupBy
      .mockResolvedValueOnce([
        { recipientId: 2, _count: { id: 2 }, _max: { createdAt: date } },
        { recipientId: 3, _count: { id: 5 }, _max: { createdAt: date } },
      ])
      .mockResolvedValueOnce([
        { senderId: 2, _count: { id: 4 }, _max: { createdAt: date } },
      ]);
    prisma.customerProfile.findMany.mockResolvedValue([
      { id: 2, firstName: 'A', lastName: 'B' },
      { id: 3, firstName: 'C', lastName: 'D' },
    ] as never);
    const result = await service.getRecipientSuggestions(1, 3);
    expect(prisma.customerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: [2, 3] },
          businessId: 3,
          isDeleted: false,
          isActive: true,
          OR: [{ user: null }, { user: { isBlocked: false } }],
        },
      }),
    );
    expect(result.map((item) => [item.customer.id, item.parcelCount])).toEqual([
      [2, 6],
      [3, 5],
    ]);
  });
});
