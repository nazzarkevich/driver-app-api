import { ConflictException } from '@nestjs/common';
import { DeliveryStatus, Prisma } from '@prisma/client';
import { ParcelsService } from './parcels.service';

function setup(status: DeliveryStatus = DeliveryStatus.InTransit) {
  let row: any = {
    id: 18,
    businessId: 3,
    deliveryStatus: status,
    groupId: null,
    journeyId: 12,
    pickedUpByDriverId: null,
    pickedUpByCourierId: null,
    pickedUpAt: null,
  };
  const tx: any = {
    parcel: {
      findFirst: jest.fn(async () => row),
      findMany: jest.fn(async () => [row]),
      updateMany: jest.fn(async ({ where, data }) => {
        if (where.deliveryStatus && where.deliveryStatus !== row.deliveryStatus)
          return { count: 0 };
        row = { ...row, ...data };
        return { count: 1 };
      }),
    },
    auditLog: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const service: any = Object.create(ParcelsService.prototype);
  service.prismaService = {
    $transaction: jest.fn(async (action) => action(tx)),
  };
  service.validateBusinessAccess = jest.fn();
  service.resolveUserProfile = jest.fn().mockResolvedValue({ driverId: 51 });
  service.attachGroupSize = jest.fn(async (parcels) => parcels);
  service.auditService = { log: jest.fn() };
  return { service, tx, row: () => row };
}

describe('legacy pickup action', () => {
  it('records pickup without rewinding an active journey, and leaves facts intact on retry', async () => {
    const { service, tx, row } = setup();
    await service.markAsPickedUp(18, 3, 7);
    const recordedAt = row().pickedUpAt;
    expect(row()).toMatchObject({
      deliveryStatus: 'InTransit',
      pickedUpByDriverId: 51,
    });
    expect(recordedAt).toBeInstanceOf(Date);
    await service.markAsPickedUp(18, 3, 7);
    expect(row().pickedUpAt).toBe(recordedAt);
    expect(tx.auditLog.createMany).toHaveBeenCalledTimes(1);
    expect(service.prismaService.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    service.resolveUserProfile.mockResolvedValue({ courierId: 61 });
    await expect(service.markAsPickedUp(18, 3, 8)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(row().pickedUpAt).toBe(recordedAt);
  });
  it('advances only an awaiting-pickup parcel', async () => {
    const { service, row } = setup(DeliveryStatus.AwaitingPickup);
    await service.markAsPickedUp(18, 3, 7);
    expect(row().deliveryStatus).toBe('PickedUp');
  });
  it('preserves warehouse progress and rejects terminal parcels', async () => {
    const { service, row } = setup(DeliveryStatus.AtOriginWarehouse);
    await service.markAsPickedUp(18, 3, 7);
    expect(row().deliveryStatus).toBe('AtOriginWarehouse');
    const terminal = setup(DeliveryStatus.Delivered);
    await expect(
      terminal.service.markAsPickedUp(18, 3, 7),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(terminal.tx.parcel.updateMany).not.toHaveBeenCalled();
  });
});
