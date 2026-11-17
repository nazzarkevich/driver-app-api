import {
  ConflictException,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  DeliveryStatus,
  JourneyStatus,
  Prisma,
  UserType,
} from '@prisma/client';
import { JourneysService } from './journeys.service';
import { JourneysController } from './journeys.controller';
import { PermissionsGuard } from 'src/guards/permissions.guard';

const user = {
  id: 7,
  businessId: 3,
  type: UserType.InternationalDriver,
  name: 'Driver',
  isAdmin: false,
  isSuperAdmin: false,
  iat: 0,
  exp: 9999999999,
};
const updatedAt = new Date('2026-11-01T00:00:00Z');
const journey = {
  id: 11,
  businessId: 3,
  status: JourneyStatus.Scheduled,
  updatedAt,
  driverProfiles: [{ id: 5 }],
};
function setup() {
  const tx = {
    journey: {
      findFirst: jest.fn().mockResolvedValue(journey),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    parcel: {
      findMany: jest.fn().mockResolvedValue([
        { id: 1, deliveryStatus: DeliveryStatus.PickedUp, isDamaged: false },
        {
          id: 2,
          deliveryStatus: DeliveryStatus.AtOriginWarehouse,
          isDamaged: false,
        },
        { id: 3, deliveryStatus: DeliveryStatus.Delivered, isDamaged: false },
      ]),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    parcelStatusTransition: { createMany: jest.fn() },
    journeyStatusTransition: { create: jest.fn() },
    auditLog: { createMany: jest.fn() },
  };
  const prisma = {
    driverProfile: { findFirst: jest.fn().mockResolvedValue({ id: 5 }) },
    $transaction: jest.fn(async (callback, _options) => callback(tx)),
  };
  const service = new JourneysService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  jest.spyOn(service, 'findOne').mockResolvedValue(journey as any);
  return { service, prisma, tx };
}
const body = { expectedUpdatedAt: updatedAt.toISOString() };
describe('journey start', () => {
  it('starts an assigned driver journey and ready parcels atomically, with audit records', async () => {
    const { service, prisma, tx } = setup();
    await service.startJourney(11, body, user);
    expect(prisma.driverProfile.findFirst).toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(tx.parcel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { journeyId: 11, businessId: 3, isDeleted: false },
      }),
    );
    expect(tx.parcel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { deliveryStatus: DeliveryStatus.InTransit },
      }),
    );
    expect(tx.journey.updateMany).toHaveBeenCalledWith({
      where: { id: 11, updatedAt },
      data: {
        status: JourneyStatus.InTransit,
        actualDepartureAt: expect.any(Date),
        isCompleted: false,
      },
    });
    expect(
      tx.parcelStatusTransition.createMany.mock.calls[0][0].data,
    ).toHaveLength(2);
    expect(tx.auditLog.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(tx.journeyStatusTransition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: JourneyStatus.Scheduled,
          toStatus: JourneyStatus.InTransit,
          actorId: 7,
          businessId: 3,
        }),
      }),
    );
  });
  it.each(['isAdmin', 'isSuperAdmin'] as const)(
    'lets %s start a company journey without driver assignment',
    async (flag) => {
      const { service, prisma } = setup();
      prisma.driverProfile.findFirst.mockResolvedValue({ id: 99 });
      await service.startJourney(11, body, { ...user, [flag]: true });
      expect(service.findOne).toHaveBeenCalledWith(11, 3);
      expect(prisma.driverProfile.findFirst).not.toHaveBeenCalled();
    },
  );
  it('rejects an unassigned driver before opening a transaction', async () => {
    const { service, prisma } = setup();
    prisma.driverProfile.findFirst.mockResolvedValue({ id: 99 });
    await expect(service.startJourney(11, body, user)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it.each([
    JourneyStatus.InTransit,
    JourneyStatus.Completed,
    JourneyStatus.Cancelled,
  ])('rejects status %s without writes', async (status) => {
    const { service, tx } = setup();
    tx.journey.findFirst.mockResolvedValue({ ...journey, status });
    await expect(service.startJourney(11, body, user)).rejects.toThrow(
      ConflictException,
    );
    expect(tx.parcel.updateMany).not.toHaveBeenCalled();
  });
  it('rejects stale confirmations without writes', async () => {
    const { service, tx } = setup();
    await expect(
      service.startJourney(
        11,
        { expectedUpdatedAt: new Date(0).toISOString() },
        user,
      ),
    ).rejects.toThrow(ConflictException);
    expect(tx.parcel.updateMany).not.toHaveBeenCalled();
  });
  it.each([
    [
      [
        {
          id: 1,
          deliveryStatus: DeliveryStatus.AwaitingPickup,
          isDamaged: false,
        },
      ],
      'JOURNEY_PARCELS_NOT_READY',
    ],
    [
      [{ id: 1, deliveryStatus: DeliveryStatus.PickedUp, isDamaged: true }],
      'JOURNEY_PARCELS_NOT_READY',
    ],
  ])('rejects unready parcels with code %s', async (parcels, code) => {
    const { service, tx } = setup();
    tx.parcel.findMany.mockResolvedValue(parcels as any);
    const error = await service
      .startJourney(11, body, user)
      .catch((failure) => failure);
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toMatchObject({ code });
    expect(tx.parcel.updateMany).not.toHaveBeenCalled();
  });
  it.each([
    { parcels: [] },
    {
      parcels: [
        { id: 3, deliveryStatus: DeliveryStatus.Delivered, isDamaged: false },
      ],
    },
  ])(
    'starts a journey with no active parcels ($parcels.length total)',
    async ({ parcels }) => {
      const { service, tx } = setup();
      tx.parcel.findMany.mockResolvedValue(parcels as any);
      await service.startJourney(11, body, user);
      expect(tx.journey.updateMany).toHaveBeenCalledWith({
        where: { id: 11, updatedAt },
        data: {
          status: JourneyStatus.InTransit,
          actualDepartureAt: expect.any(Date),
          isCompleted: false,
        },
      });
      expect(tx.journeyStatusTransition.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fromStatus: JourneyStatus.Scheduled,
            toStatus: JourneyStatus.InTransit,
          }),
        }),
      );
      expect(tx.parcel.updateMany).not.toHaveBeenCalled();
      expect(tx.parcelStatusTransition.createMany).not.toHaveBeenCalled();
      expect(tx.auditLog.createMany).not.toHaveBeenCalled();
    },
  );
  it('rejects a concurrent manifest change before updating the journey', async () => {
    const { service, tx } = setup();
    tx.parcel.updateMany.mockResolvedValue({ count: 1 });
    await expect(service.startJourney(11, body, user)).rejects.toThrow(
      ConflictException,
    );
    expect(tx.journey.updateMany).not.toHaveBeenCalled();
  });
  it('keeps the journey lookup scoped to the authenticated business', async () => {
    const { service, prisma } = setup();
    jest.spyOn(service, 'findOne').mockRejectedValue(new ForbiddenException());
    await expect(
      service.startJourney(11, body, { ...user, isAdmin: true }),
    ).rejects.toThrow(ForbiddenException);
    expect(service.findOne).toHaveBeenCalledWith(11, 3);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('journey start permissions', () => {
  function allowed(
    type: UserType,
    isAdmin = false,
    action: 'startJourney' | 'cancelJourney' = 'startJourney',
  ) {
    const context = {
      getHandler: () => JourneysController.prototype[action],
      getClass: () => JourneysController,
      switchToHttp: () => ({
        getRequest: () => ({ currentUser: { ...user, type, isAdmin } }),
      }),
    } as unknown as ExecutionContext;
    return new PermissionsGuard(new Reflector()).canActivate(context);
  }
  it.each([UserType.InternationalDriver, UserType.Manager, UserType.Moderator])(
    'retains %s start access',
    (type) => expect(allowed(type)).toBe(true),
  );
  it.each([UserType.ParcelCourier, UserType.Member, UserType.Customer])(
    'allows %s admins to start without granting cancel access',
    (type) => {
      expect(allowed(type, true)).toBe(true);
      expect(allowed(type)).toBe(false);
      expect(allowed(type, true, 'cancelJourney')).toBe(false);
    },
  );
});
