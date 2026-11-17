import { DeliveryStatus, UserType } from '@prisma/client';
import { ParcelsService } from './parcels.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { TariffsService } from 'src/tariffs/tariffs.service';
import { AuditService } from 'src/audit/audit.service';
import {
  isNovaPostDestination,
  validateNovaTracking,
} from './parcel-status-rules';
const user = {
  id: 7,
  businessId: 3,
  type: UserType.Manager,
  isAdmin: false,
  isSuperAdmin: false,
  name: 'Manager',
  iat: 1,
  exp: 2,
};
const now = new Date('2026-11-17T12:00:00Z');
function setup(overrides: Record<string, unknown> = {}) {
  let parcel = {
    id: 18,
    businessId: 3,
    deliveryStatus: DeliveryStatus.InTransit,
    destinationType: 'NovaPostWarehouse',
    destinationSnapshot: { type: 'NovaPostWarehouse' },
    updatedAt: now,
    isDeleted: false,
    isArchived: false,
    isDamaged: false,
    novaPostTrackingNumber: null,
    novaPostTrackingNumberUpdatedAt: null,
    createdAt: now,
    price: 35,
    weight: 2.5,
    paymentStatus: 'NotPaid',
    ...overrides,
  };
  const tx = {
    parcel: {
      findFirst: jest.fn(async ({ where }) =>
        where.businessId === parcel.businessId ? parcel : null,
      ),
      updateMany: jest.fn(async ({ data }) => {
        parcel = { ...parcel, ...data };
        return { count: 1 };
      }),
      findUniqueOrThrow: jest.fn(async () => parcel),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    parcelStatusTransition: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    business: {
      findUnique: jest.fn().mockResolvedValue({ id: 3, isActive: true }),
    },
    $transaction: jest.fn(async (fn) => fn(tx)),
  };
  const service = new ParcelsService(
    prisma as unknown as PrismaService,
    {} as UsersService,
    {} as TariffsService,
    {} as AuditService,
  );
  return { service, tx, parcel: () => parcel };
}
describe('parcel status operations', () => {
  it('advances and records both the transition and audit event', async () => {
    const { service, tx } = setup();
    const result = await service.transitionStatus(
      18,
      {
        toStatus: DeliveryStatus.AtDestinationWarehouse,
        expectedUpdatedAt: now.toISOString(),
      },
      user,
    );
    expect(result.deliveryStatus).toBe(DeliveryStatus.AtDestinationWarehouse);
    expect(tx.parcelStatusTransition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: 'InTransit',
          toStatus: 'AtDestinationWarehouse',
          businessId: 3,
          actorId: 7,
        }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });
  it('hands over atomically with normalized tracking and a timestamp', async () => {
    const { service, tx } = setup({
      deliveryStatus: DeliveryStatus.AtDestinationWarehouse,
    });
    const result = await service.transitionStatus(
      18,
      {
        toStatus: DeliveryStatus.AtNovaPostWarehouse,
        novaPostTrackingNumber: '20 4500 0000 0000',
        expectedUpdatedAt: now.toISOString(),
      },
      user,
    );
    expect(result.novaPostTrackingNumber).toBe('20450000000000');
    expect(result.novaPostTrackingNumberUpdatedAt).toBeInstanceOf(Date);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(2);
  });
  it.each(['2045000000000', '204500000000000'])(
    'rejects tracking with the wrong digit count without truncation: %s',
    async (number) => {
      const { service, tx } = setup({
        deliveryStatus: DeliveryStatus.AtDestinationWarehouse,
      });
      await expect(
        service.transitionStatus(
          18,
          {
            toStatus: DeliveryStatus.AtNovaPostWarehouse,
            novaPostTrackingNumber: number,
            expectedUpdatedAt: now.toISOString(),
          },
          user,
        ),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_NOVA_POST_TRACKING' },
      });
      expect(tx.parcel.updateMany).not.toHaveBeenCalled();
    },
  );
  it('changes tracking after delivery without modifying delivery metadata', async () => {
    const deliveredAt = new Date('2026-11-16T10:00:00Z');
    const { service, tx } = setup({
      deliveryStatus: DeliveryStatus.Delivered,
      deliveredAt,
      deliveredByDriverId: 9,
      novaPostTrackingNumber: '20450000000000',
    });
    const result = await service.updateNovaPostTracking(
      18,
      {
        novaPostTrackingNumber: '20 4500 0000 0001',
        expectedUpdatedAt: now.toISOString(),
      },
      user,
    );
    expect(result.deliveryStatus).toBe(DeliveryStatus.Delivered);
    expect(result.deliveredAt).toEqual(deliveredAt);
    expect(tx.parcel.updateMany.mock.calls[0][0].data).toEqual({
      novaPostTrackingNumber: '20450000000001',
      novaPostTrackingNumberUpdatedAt: expect.any(Date),
    });
    expect(tx.parcelStatusTransition.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create.mock.calls[0][0].data.metadata.eventType).toBe(
      'NovaPostTrackingUpdated',
    );
  });
  it('blocks unchanged tracking and Nova Post writes to a snapshot-backed home address', async () => {
    const same = setup({ novaPostTrackingNumber: '20450000000000' });
    await expect(
      same.service.updateNovaPostTracking(
        18,
        {
          novaPostTrackingNumber: '20450000000000',
          expectedUpdatedAt: now.toISOString(),
        },
        user,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PARCEL_TRACKING_UNCHANGED' },
    });
    const direct = setup({ destinationSnapshot: { type: 'CustomerAddress' } });
    await expect(
      direct.service.updateNovaPostTracking(
        18,
        {
          novaPostTrackingNumber: '20450000000001',
          expectedUpdatedAt: now.toISOString(),
        },
        user,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PARCEL_DESTINATION_NOT_NOVA_POST' },
    });
    expect(direct.tx.parcel.updateMany).not.toHaveBeenCalled();
  });
  it('records damage without changing the current stage and can resolve it', async () => {
    const { service, tx } = setup();
    const result = await service.reportDamage(
      18,
      { reason: '  Розбите скло  ', expectedUpdatedAt: now.toISOString() },
      user,
    );
    expect(result.isDamaged).toBe(true);
    expect(result.deliveryStatus).toBe(DeliveryStatus.InTransit);
    expect(
      tx.auditLog.create.mock.calls[0][0].data.metadata.details.reason,
    ).toBe('Розбите скло');
    expect(
      (
        await service.resolveDamage(
          18,
          { expectedUpdatedAt: now.toISOString() },
          user,
        )
      ).isDamaged,
    ).toBe(false);
  });
  it('requires an actual reason for damage and loss', async () => {
    const { service, tx } = setup();
    await expect(
      service.reportDamage(
        18,
        { reason: '   ', expectedUpdatedAt: now.toISOString() },
        user,
      ),
    ).rejects.toMatchObject({ response: { code: 'PARCEL_REASON_REQUIRED' } });
    await expect(
      service.transitionStatus(
        18,
        {
          toStatus: DeliveryStatus.Lost,
          reason: '   ',
          expectedUpdatedAt: now.toISOString(),
        },
        user,
      ),
    ).rejects.toBeDefined();
    expect(tx.parcel.updateMany).not.toHaveBeenCalled();
  });
  it.each([
    DeliveryStatus.Delivered,
    DeliveryStatus.Cancelled,
    DeliveryStatus.Returned,
    DeliveryStatus.Lost,
  ])(
    'rejects damage and normal advances from terminal status %s',
    async (status) => {
      const { service, tx } = setup({ deliveryStatus: status });
      await expect(
        service.reportDamage(
          18,
          { reason: 'damage', expectedUpdatedAt: now.toISOString() },
          user,
        ),
      ).rejects.toBeDefined();
      await expect(
        service.transitionStatus(
          18,
          {
            toStatus: DeliveryStatus.Lost,
            reason: 'lost',
            expectedUpdatedAt: now.toISOString(),
          },
          user,
        ),
      ).rejects.toBeDefined();
      expect(tx.parcel.updateMany).not.toHaveBeenCalled();
    },
  );
  it('corrects delivery status and keeps corrections blocked during damage', async () => {
    const first = setup({
      deliveryStatus: DeliveryStatus.Delivered,
      deliveredAt: now,
    });
    const result = await first.service.correctStatus(
      18,
      {
        toStatus: DeliveryStatus.AtOriginWarehouse,
        expectedUpdatedAt: now.toISOString(),
      },
      user,
    );
    expect(result.deliveryStatus).toBe(DeliveryStatus.AtOriginWarehouse);
    expect(result.deliveredAt).toBeNull();
    const damaged = setup({ isDamaged: true });
    await expect(
      damaged.service.correctStatus(
        18,
        {
          toStatus: DeliveryStatus.AtOriginWarehouse,
          expectedUpdatedAt: now.toISOString(),
        },
        user,
      ),
    ).rejects.toMatchObject({ response: { code: 'PARCEL_DAMAGE_ACTIVE' } });
  });
  it('blocks stale versions, archives and another business without writing', async () => {
    for (const overrides of [
      { isArchived: true },
      { updatedAt: new Date('2026-11-17T13:00:00Z') },
      { businessId: 9 },
    ]) {
      const { service, tx } = setup(overrides);
      await expect(
        service.updateNovaPostTracking(
          18,
          {
            novaPostTrackingNumber: '20450000000001',
            expectedUpdatedAt: now.toISOString(),
          },
          user,
        ),
      ).rejects.toBeDefined();
      expect(tx.parcel.updateMany).not.toHaveBeenCalled();
    }
  });
  it('handles a racing update inside the transaction', async () => {
    const { service, tx } = setup();
    tx.parcel.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.transitionStatus(
        18,
        {
          toStatus: DeliveryStatus.AtDestinationWarehouse,
          expectedUpdatedAt: now.toISOString(),
        },
        user,
      ),
    ).rejects.toMatchObject({ response: { code: 'PARCEL_CHANGED' } });
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
  it('shares the canonical destination rule and strict tracking validation', () => {
    expect(
      isNovaPostDestination({
        destinationSnapshot: { type: 'CustomerAddress' },
        destinationType: 'NovaPostWarehouse',
      }),
    ).toBe(false);
    expect(
      isNovaPostDestination({
        destinationType: 'CustomerAddress',
        novaPostWarehouseId: 1,
      }),
    ).toBe(false);
    expect(isNovaPostDestination({ novaPostWarehouseId: 1 })).toBe(true);
    expect(validateNovaTracking('20 4500 0000 0000')).toBe('20450000000000');
  });
});
