import { BadRequestException } from '@nestjs/common';
import { UserType } from '@prisma/client';
import { JourneysService } from './journeys.service';
import { JourneysController } from './journeys.controller';
import prismaWithPagination from 'src/prisma/prisma-client';
import type { PrismaService } from 'src/prisma/prisma.service';
import type { ParcelsService } from 'src/parcels/parcels.service';
import type { VehiclesService } from 'src/vehicles/vehicles.service';
import type { DriversService } from 'src/profiles/drivers/drivers.service';
import type { JourneyNumberService } from './services/journey-number.service';
import type { JourneySummaryService } from './services/journey-summary.service';

const mockWithPages = jest.fn();
jest.mock('src/prisma/prisma-client', () => ({
  __esModule: true,
  default: {
    journey: { paginate: jest.fn(() => ({ withPages: mockWithPages })) },
  },
}));
const user = {
  id: 7,
  name: 'Test',
  businessId: 3,
  type: UserType.Manager,
  isAdmin: false,
  isSuperAdmin: false,
  iat: 0,
  exp: 9999999999,
};
function createService() {
  const prisma = {
    business: {
      findUnique: jest.fn().mockResolvedValue({ id: 3, isActive: true }),
    },
    journey: { findMany: jest.fn(async (_args: any) => []) },
  };
  const service = new JourneysService(
    prisma as unknown as PrismaService,
    {} as ParcelsService,
    {} as VehiclesService,
    {} as DriversService,
    {} as JourneyNumberService,
  );
  return { service, prisma };
}
beforeEach(() => {
  jest.clearAllMocks();
  mockWithPages.mockResolvedValue([[], { currentPage: 1 }]);
});
describe('journey search', () => {
  it('searches journey number, vehicle and driver names before pagination while retaining filters', async () => {
    const { service } = createService();
    await service.findAll(
      3,
      2,
      false,
      undefined,
      undefined,
      undefined,
      1,
      2,
      user,
      '  Ivan  Koval ',
    );
    const args = (prismaWithPagination.journey.paginate as jest.Mock).mock
      .calls[0][0];
    expect(args.where).toMatchObject({
      businessId: 3,
      isDeleted: false,
      isCompleted: false,
      isArchived: false,
      startCountryId: 1,
      endCountryId: 2,
    });
    expect(args.where.AND).toHaveLength(2);
    for (const [index, term] of ['Ivan', 'Koval'].entries()) {
      const filter = { contains: term, mode: 'insensitive' };
      expect(args.where.AND[index].OR).toEqual([
        { journeyNumber: filter },
        { vehicle: { is: { plateNumber: filter } } },
        { vehicle: { is: { make: filter } } },
        { vehicle: { is: { model: filter } } },
        { driverProfiles: { some: { user: { is: { firstName: filter } } } } },
        { driverProfiles: { some: { user: { is: { lastName: filter } } } } },
      ]);
    }
    expect(mockWithPages).toHaveBeenCalledWith({ page: 2 });
  });
  it.each([undefined, '', '   '])(
    'omits search conditions for %s',
    async (search) => {
      const { service } = createService();
      await service.findAll(
        3,
        1,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        user,
        search,
      );
      expect(
        (prismaWithPagination.journey.paginate as jest.Mock).mock.calls[0][0]
          .where.AND,
      ).toBeUndefined();
    },
  );
  it('also applies search to the unpaginated endpoint', async () => {
    const { service, prisma } = createService();
    await service.findAll(
      3,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      user,
      'Sprinter',
    );
    expect(prisma.journey.findMany.mock.calls[0][0].where).toMatchObject({
      businessId: 3,
      AND: [{ OR: expect.any(Array) }],
    });
  });
  it('forwards search and existing filters from the controller', async () => {
    const findAll = jest.fn().mockResolvedValue({ items: [] });
    const controller = new JourneysController(
      { findAll } as unknown as JourneysService,
      {} as JourneySummaryService,
    );
    await controller.findAllJourneys(
      user,
      '2',
      'false',
      undefined,
      undefined,
      undefined,
      '1',
      '2',
      'SLV-16',
    );
    expect(findAll).toHaveBeenCalledWith(
      3,
      2,
      false,
      undefined,
      undefined,
      undefined,
      1,
      2,
      user,
      'SLV-16',
      false,
      undefined,
    );
  });
});

describe('journey trailer filtering', () => {
  it.each([true, false, undefined])(
    'filters paginated and unpaginated reads by %s without losing other filters',
    async (hasTrailer) => {
      const { service, prisma } = createService();
      for (const page of [2, undefined]) {
        const result = await service.findAll(
          3,
          page,
          false,
          undefined,
          new Date('2026-11-01'),
          new Date('2026-11-03'),
          1,
          2,
          user,
          'Sprinter',
          false,
          hasTrailer,
        );
        const args = page
          ? (prismaWithPagination.journey.paginate as jest.Mock).mock
              .calls[0][0]
          : prisma.journey.findMany.mock.calls[0][0];
        expect(args.where).toMatchObject({
          businessId: 3,
          isDeleted: false,
          isCompleted: false,
          startCountryId: 1,
          endCountryId: 2,
          departureDate: {
            gte: new Date('2026-11-01'),
            lte: new Date('2026-11-03T23:59:59.999Z'),
          },
          AND: [{ OR: expect.any(Array) }],
        });
        if (hasTrailer === undefined) {
          expect(args.where).not.toHaveProperty('hasTrailer');
        } else {
          expect(args.where.hasTrailer).toBe(hasTrailer);
        }
        if (page) {
          expect(mockWithPages).toHaveBeenCalledWith({ page: 2 });
          expect(result).toEqual({ items: [], currentPage: 1 });
        }
      }
    },
  );

  it.each([
    ['true', true],
    ['false', false],
    [undefined, undefined],
  ])('forwards optional query %s as %s', async (value, expected) => {
    const findAll = jest.fn().mockResolvedValue({ items: [] });
    const controller = new JourneysController(
      { findAll } as unknown as JourneysService,
      {} as JourneySummaryService,
    );
    await controller.findAllJourneys(
      user,
      '2',
      'false',
      undefined,
      undefined,
      undefined,
      '1',
      '2',
      'SLV-16',
      'true',
      value,
    );
    expect(findAll).toHaveBeenCalledWith(
      3,
      2,
      false,
      undefined,
      undefined,
      undefined,
      1,
      2,
      user,
      'SLV-16',
      true,
      expected,
    );
  });

  it.each(['', 'yes', '0', '1', 'TRUE', ['true', 'false']])(
    'rejects invalid trailer filter %s before querying',
    async (value) => {
      const findAll = jest.fn();
      const controller = new JourneysController(
        { findAll } as unknown as JourneysService,
        {} as JourneySummaryService,
      );
      await expect(
        controller.findAllJourneys(
          user,
          '1',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          value as string,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(findAll).not.toHaveBeenCalled();
    },
  );
});
