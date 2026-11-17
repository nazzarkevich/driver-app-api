import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserType } from '@prisma/client';
import { JourneysService } from './journeys.service';
import type { JourneyDto } from './dtos/journey.dto';
import type { PrismaService } from 'src/prisma/prisma.service';
import type { ParcelsService } from 'src/parcels/parcels.service';
import type { VehiclesService } from 'src/vehicles/vehicles.service';
import type { DriversService } from 'src/profiles/drivers/drivers.service';
import type { JourneyNumberService } from './services/journey-number.service';

jest.mock('src/prisma/prisma-client', () => ({
  __esModule: true,
  default: {},
}));
const user = {
  id: 7,
  name: 'Test',
  businessId: 3,
  type: UserType.InternationalDriver,
  isAdmin: false,
  isSuperAdmin: false,
  iat: 0,
  exp: 9999999999,
};
const body = {
  startCountryId: 47,
  endCountryId: 92,
  vehicleId: 4,
  departureDate: new Date('2026-11-15T00:00:00Z'),
  parcels: [],
  driverProfiles: [52],
  hasTrailer: false,
  notes: '',
};
function setup() {
  const tx = {
    journey: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 87 }),
    },
  };
  const prisma = {
    business: {
      findUnique: jest.fn().mockResolvedValue({ id: 3, isActive: true }),
    },
    $transaction: jest.fn(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    ),
  };
  const drivers = {
    findManyByIds: jest
      .fn()
      .mockImplementation(async (ids: number[]) => ids.map((id) => ({ id }))),
  };
  const service = new JourneysService(
    prisma as unknown as PrismaService,
    {
      findParcelsByIds: jest.fn().mockResolvedValue([]),
    } as unknown as ParcelsService,
    {
      findOne: jest.fn().mockResolvedValue({ id: 4, isActive: true }),
    } as unknown as VehiclesService,
    drivers as unknown as DriversService,
    {
      generateUniqueJourneyNumber: jest.fn().mockResolvedValue('NEW-JOURNEY'),
    } as unknown as JourneyNumberService,
  );
  jest
    .spyOn(service, 'findOneForUser')
    .mockResolvedValue({ id: 87 } as JourneyDto);
  return { service, drivers, prisma, tx };
}
describe('journey crew selection at creation', () => {
  it.each([[52], [52, 53]])(
    'honors another selected crew for an international driver: %j',
    async (...driverIds) => {
      const { service, drivers, tx } = setup();
      await expect(
        service.createJourney({ ...body, driverProfiles: driverIds }, user),
      ).resolves.toMatchObject({ id: 87 });
      expect(drivers.findManyByIds).toHaveBeenCalledWith(
        driverIds,
        user.businessId,
      );
      expect(tx.journey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            businessId: 3,
            driverProfiles: { connect: driverIds.map((id) => ({ id })) },
          }),
        }),
      );
    },
  );
  it('still permits selecting the current driver explicitly', async () => {
    const { service, drivers } = setup();
    await service.createJourney({ ...body, driverProfiles: [51] }, user);
    expect(drivers.findManyByIds).toHaveBeenCalledWith([51], 3);
  });
  it('does not bypass validation of unavailable or cross-business drivers', async () => {
    const { service, drivers, prisma } = setup();
    drivers.findManyByIds.mockRejectedValue(new NotFoundException());
    await expect(service.createJourney(body, user)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects an empty crew instead of silently substituting the current driver', async () => {
    const { service, prisma } = setup();
    await expect(
      service.createJourney({ ...body, driverProfiles: [] }, user),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
