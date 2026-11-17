import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JourneyStatus, UserType } from '@prisma/client';
import { JourneysService } from './journeys.service';
import { JourneysController } from './journeys.controller';
import type { JourneySummaryService } from './services/journey-summary.service';

const user = {
  id: 7,
  businessId: 3,
  type: UserType.Manager,
  name: 'Manager',
  isAdmin: false,
  isSuperAdmin: false,
  iat: 0,
  exp: 9999999999,
};
const journey = {
  id: 11,
  businessId: 3,
  status: JourneyStatus.Scheduled,
  startCountryId: 1,
  endCountryId: 2,
  departureDate: new Date('2026-11-01T00:00:00Z'),
  vehicle: { id: 4 },
  driverProfiles: [{ id: 5 }],
  notes: null,
};
function setup() {
  const prisma = {
    business: {
      findUnique: jest.fn().mockResolvedValue({ id: 3, isActive: true }),
    },
    journey: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    journeyNote: { create: jest.fn() },
    driverProfile: { findFirst: jest.fn().mockResolvedValue({ id: 99 }) },
  };
  const vehicles = {
    findAll: jest.fn().mockResolvedValue([
      { id: 4, isActive: true },
      { id: 6, isActive: true },
      { id: 7, isActive: false },
    ]),
    findOne: jest.fn(),
  };
  const drivers = { findManyByIds: jest.fn() };
  const service = new JourneysService(
    prisma as any,
    {} as any,
    vehicles as any,
    drivers as any,
    {} as any,
  );
  jest.spyOn(service, 'findOne').mockResolvedValue(journey as any);
  return { service, prisma, vehicles, drivers };
}
describe('journey editing', () => {
  it('excludes only this business journey from availability and retains active bookings', async () => {
    const { service, prisma } = setup();
    prisma.journey.findMany.mockResolvedValue([{ vehicleId: 6 }]);
    const result = await service.getAvailableVehicles(
      new Date('2026-11-01T00:00:00Z'),
      3,
      11,
    );
    expect(service.findOne).toHaveBeenCalledWith(11, 3);
    expect(prisma.journey.findMany.mock.calls[0][0].where).toMatchObject({
      businessId: 3,
      id: { not: 11 },
      isDeleted: false,
      status: { in: [JourneyStatus.Scheduled, JourneyStatus.InTransit] },
      departureDate: { gte: expect.any(Date), lt: expect.any(Date) },
    });
    expect(result).toEqual([{ id: 4, isActive: true }]);
  });
  it('does not exclude any journey during creation', async () => {
    const { service, prisma } = setup();
    await service.getAvailableVehicles(new Date(), 3);
    expect(prisma.journey.findMany.mock.calls[0][0].where).not.toHaveProperty(
      'id',
    );
  });
  it('saves route, date, crew, vehicle, trailer and an appended note', async () => {
    const { service, prisma, drivers } = setup();
    await service.update(
      11,
      {
        startCountryId: 2,
        endCountryId: 1,
        departureDate: new Date('2026-11-03'),
        vehicleId: 6,
        driverProfiles: [5, 8],
        hasTrailer: true,
        notes: 'Note',
      },
      user,
    );
    expect(drivers.findManyByIds).toHaveBeenCalledWith([5, 8], 3);
    expect(prisma.journey.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: {
        startCountry: { connect: { id: 2 } },
        endCountry: { connect: { id: 1 } },
        departureDate: new Date('2026-11-03'),
        vehicle: { connect: { id: 6 } },
        driverProfiles: { set: [], connect: [{ id: 5 }, { id: 8 }] },
        hasTrailer: true,
      },
    });
    expect(prisma.journeyNote.create).toHaveBeenCalledWith({
      data: { journeyId: 11, userId: 7, content: 'Note' },
    });
  });
  it('rejects a vehicle booked on the edited date before writing', async () => {
    const { service, prisma } = setup();
    prisma.journey.findMany.mockResolvedValue([{ vehicleId: 4 }]);
    await expect(
      service.update(11, { departureDate: new Date('2026-11-03') }, user),
    ).rejects.toThrow(ConflictException);
    expect(prisma.journey.update).not.toHaveBeenCalled();
    expect(prisma.journeyNote.create).not.toHaveBeenCalled();
  });
  it('retains existing schedule and crew for a trailer-only edit', async () => {
    const { service, prisma } = setup();
    await service.update(11, { hasTrailer: false }, user);
    expect(prisma.journey.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { hasTrailer: false },
    });
    expect(prisma.journey.findMany).not.toHaveBeenCalled();
  });
  it.each([JourneyStatus.Completed, JourneyStatus.Cancelled])(
    'rejects editing %s',
    async (status) => {
      const { service, prisma } = setup();
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue({ ...journey, status } as any);
      await expect(
        service.update(11, { hasTrailer: false }, user),
      ).rejects.toThrow(ConflictException);
      expect(prisma.journey.update).not.toHaveBeenCalled();
    },
  );
  it.each([{ startCountryId: 2 }, { driverProfiles: [] }])(
    'rejects invalid route or empty crew',
    async (changes) => {
      const { service, prisma } = setup();
      await expect(service.update(11, changes, user)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.journey.update).not.toHaveBeenCalled();
    },
  );
  it('rejects an unassigned driver', async () => {
    const { service, prisma } = setup();
    await expect(
      service.update(
        11,
        { hasTrailer: false },
        { ...user, type: UserType.InternationalDriver },
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.journey.update).not.toHaveBeenCalled();
  });
  it('retains crew when an assigned driver changes journey details', async () => {
    const { service, prisma } = setup();
    prisma.driverProfile.findFirst.mockResolvedValue({ id: 5 });
    await service.update(
      11,
      { hasTrailer: false, driverProfiles: [8] },
      { ...user, type: UserType.InternationalDriver },
    );
    expect(prisma.journey.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { hasTrailer: false },
    });
  });
  it('forwards validated exclusion IDs and rejects invalid query values', async () => {
    const getAvailableVehicles = jest.fn().mockResolvedValue([]);
    const controller = new JourneysController(
      { getAvailableVehicles } as any,
      {} as JourneySummaryService,
    );
    await controller.getAvailableVehicles(user, '2026-11-03', '11');
    expect(getAvailableVehicles).toHaveBeenCalledWith(
      new Date('2026-11-03'),
      3,
      11,
    );
    getAvailableVehicles.mockClear();
    for (const value of ['', '0', '-1', '1.5', 'abc', '9007199254740992'])
      await expect(
        controller.getAvailableVehicles(user, '2026-11-03', value),
      ).rejects.toThrow(BadRequestException);
    await expect(controller.getAvailableVehicles(user, 'bad')).rejects.toThrow(
      BadRequestException,
    );
    expect(getAvailableVehicles).not.toHaveBeenCalled();
  });
});

describe('in-progress journey editing', () => {
  it('allows an admin manager to update details without changing journey status', async () => {
    const { service, prisma } = setup();
    jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({
        ...journey,
        status: JourneyStatus.InTransit,
      } as any);
    await service.update(
      11,
      { hasTrailer: false, notes: 'In-progress update' },
      { ...user, isAdmin: true },
    );
    expect(prisma.journey.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { hasTrailer: false },
    });
    expect(prisma.journeyNote.create).toHaveBeenCalled();
  });
});
