import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DeliveryStatus, UserType } from '@prisma/client';
import {
  pickupCollectorWhere,
  pickupStatusAfterRecording,
  resolveParcelPickup,
} from './pickup-recording';
import { ParcelPickupDto } from './dtos/parcel-pickup.dto';

const now = new Date('2026-11-24T12:00:00Z');
const manager: any = {
  id: 7,
  businessId: 3,
  type: UserType.Manager,
  isAdmin: false,
  isSuperAdmin: false,
};
const driver: any = { ...manager, type: UserType.InternationalDriver };
const tx: any = { user: { findFirst: jest.fn() } };
beforeEach(() => {
  jest.clearAllMocks();
  tx.user.findFirst.mockResolvedValue({ id: 7 });
});

describe('pickup facts independent of delivery status', () => {
  it('infers the authenticated driver for an older active-journey request', async () => {
    await expect(
      resolveParcelPickup(tx, driver, undefined, true, { driverId: 51 }, now),
    ).resolves.toEqual({ driverId: 51, userId: 7, pickedUpAt: now });
    expect(tx.user.findFirst).not.toHaveBeenCalled();
  });
  it('defaults staff requests to the authenticated creator', async () => {
    await expect(
      resolveParcelPickup(tx, manager, undefined, true, {}, now),
    ).resolves.toEqual({ userId: 7, pickedUpAt: now });
    expect(tx.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: 7,
        businessId: 3,
        isBlocked: false,
        isDeleted: false,
        staffApprovalStatus: 'Approved',
      },
      select: { id: true },
    });
  });
  it('does not infer pickup without an eligible state', async () => {
    await expect(
      resolveParcelPickup(tx, driver, undefined, false, { driverId: 51 }, now),
    ).resolves.toBeNull();
  });
  it.each(['Driver', 'Courier'] as const)(
    'records an explicit active %s and historical time for staff',
    async (type) => {
      tx.user.findFirst.mockResolvedValue({
        id: 91,
        driverProfile: { id: 51 },
        courierProfile: { id: 61 },
      });
      const pickup = {
        collector: { type, profileId: type === 'Driver' ? 51 : 61 },
        pickedUpAt: '2026-11-23T09:00:00+02:00',
      };
      const result = await resolveParcelPickup(
        tx,
        manager,
        pickup,
        false,
        {},
        now,
      );
      expect(result).toEqual({
        ...(type === 'Driver' ? { driverId: 51 } : { courierId: 61 }),
        pickedUpAt: new Date('2026-11-23T07:00:00Z'),
        userId: 91,
      });
      expect(tx.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessId: 3,
            isBlocked: false,
            isDeleted: false,
            staffApprovalStatus: 'Approved',
          }),
        }),
      );
    },
  );
  it('rejects another collector for an unprivileged driver', async () => {
    await expect(
      resolveParcelPickup(
        tx,
        driver,
        { collector: { type: 'Driver', profileId: 99 } },
        false,
        { driverId: 51 },
        now,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PICKUP_COLLECTOR_FORBIDDEN' },
    });
    expect(tx.user.findFirst).not.toHaveBeenCalled();
  });
  it('rejects unavailable, blocked, deleted or foreign-business profiles', async () => {
    tx.user.findFirst.mockResolvedValue(null);
    await expect(
      resolveParcelPickup(
        tx,
        manager,
        { collector: { type: 'Courier', profileId: 99 } },
        false,
        {},
        now,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PICKUP_COLLECTOR_UNAVAILABLE' },
    });
    expect(tx.user.findFirst.mock.calls[0][0].where).toMatchObject({
      businessId: 3,
      isBlocked: false,
      isDeleted: false,
      staffApprovalStatus: 'Approved',
      courierProfile: { is: { id: 99, isDeleted: false } },
    });
  });
  it('records staff as a user, without inventing an operational profile', async () => {
    await expect(
      resolveParcelPickup(
        tx,
        manager,
        { collector: { type: 'Self' } },
        false,
        {},
        now,
      ),
    ).resolves.toEqual({ userId: 7, pickedUpAt: now });
  });
  it('rejects self attribution for an inactive staff member', async () => {
    tx.user.findFirst.mockResolvedValue(null);
    await expect(
      resolveParcelPickup(
        tx,
        manager,
        { collector: { type: 'Self' } },
        false,
        {},
        now,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PICKUP_COLLECTOR_FORBIDDEN' },
    });
  });
  it.each([
    '2026-11-25T12:00:00Z',
    '2026-02-30T12:00:00Z',
    '2026-11-23T12:00:00',
    'invalid',
  ])('rejects invalid pickup time %s', async (pickedUpAt) => {
    tx.user.findFirst.mockResolvedValue({ driverProfile: { id: 51 } });
    await expect(
      resolveParcelPickup(
        tx,
        manager,
        { collector: { type: 'Driver', profileId: 51 }, pickedUpAt },
        false,
        {},
        now,
      ),
    ).rejects.toMatchObject({ response: { code: 'PICKUP_TIME_INVALID' } });
  });
  it('prevents non-staff from backdating their pickup', async () => {
    await expect(
      resolveParcelPickup(
        tx,
        driver,
        { collector: { type: 'Self' }, pickedUpAt: '2026-11-23T10:00:00Z' },
        false,
        { driverId: 51 },
        now,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PICKUP_COLLECTOR_FORBIDDEN' },
    });
  });
  it('does not accept a profile ID on Self or two simultaneous Self profiles', async () => {
    await expect(
      resolveParcelPickup(
        tx,
        driver,
        { collector: { type: 'Self', profileId: 99 } },
        false,
        { driverId: 51 },
        now,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PICKUP_COLLECTOR_UNAVAILABLE' },
    });
    await expect(
      resolveParcelPickup(
        tx,
        driver,
        { collector: { type: 'Self' } },
        false,
        { driverId: 51, courierId: 61 },
        now,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PICKUP_COLLECTOR_FORBIDDEN' },
    });
  });
  it.each([
    DeliveryStatus.InTransit,
    DeliveryStatus.AtOriginWarehouse,
    DeliveryStatus.AtDestinationWarehouse,
    DeliveryStatus.AtNovaPostWarehouse,
  ])('preserves %s while recording collection', (status) => {
    expect(pickupStatusAfterRecording(status)).toBe(status);
  });
  it('advances only awaiting pickup to picked up', () => {
    expect(pickupStatusAfterRecording(DeliveryStatus.AwaitingPickup)).toBe(
      DeliveryStatus.PickedUp,
    );
  });
  it('requires profile identity for explicit collectors and nested valid DTOs', async () => {
    for (const payload of [
      {},
      { collector: {} },
      { collector: { type: 'Driver' } },
      { collector: { type: 'Courier', profileId: -1 } },
      { collector: { type: 'Invalid', profileId: 1 } },
    ])
      expect(
        (await validate(plainToInstance(ParcelPickupDto, payload))).length,
      ).toBeGreaterThan(0);
    expect(
      await validate(
        plainToInstance(ParcelPickupDto, { collector: { type: 'Self' } }),
      ),
    ).toHaveLength(0);
  });
  it('lists only approved operational profiles in the selected business', () => {
    expect(pickupCollectorWhere(3, 'Іван')).toMatchObject({
      businessId: 3,
      isBlocked: false,
      isDeleted: false,
      staffApprovalStatus: 'Approved',
      OR: [
        {
          type: UserType.InternationalDriver,
          driverProfile: { is: { isDeleted: false } },
        },
        {
          type: UserType.ParcelCourier,
          courierProfile: { is: { isDeleted: false } },
        },
      ],
    });
  });
});
