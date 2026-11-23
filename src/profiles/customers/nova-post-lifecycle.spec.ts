import { CustomersService } from './customers.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from 'src/audit/audit.service';
import { SupabaseService } from 'src/supabase/supabase.service';

function setup(initial = [branch(1, true), branch(2)]) {
  const state = initial;
  const matches = (item: any, where: any) =>
    (!where.id ||
      (typeof where.id === 'number'
        ? item.id === where.id
        : item.id !== where.id.not)) &&
    (!where.customerProfileId ||
      item.customerProfileId === where.customerProfileId) &&
    (where.archivedAt === undefined ||
      (where.archivedAt === null ? !item.archivedAt : !!item.archivedAt)) &&
    (where.isDefault === undefined || item.isDefault === where.isDefault) &&
    (!where.warehouse || item.warehouse.isActive);
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 10 }]),
    customerNovaPostAddress: {
      findFirst: jest.fn(
        async ({ where }) => state.find((item) => matches(item, where)) ?? null,
      ),
      findMany: jest.fn(async ({ where }) =>
        state.filter((item) => matches(item, where)),
      ),
      findUnique: jest.fn(
        async ({ where }) =>
          state.find(
            (item) =>
              item.warehouseId ===
              where.customerProfileId_warehouseId.warehouseId,
          ) ?? null,
      ),
      update: jest.fn(async ({ where, data }) => {
        const item = state.find((item) => item.id === where.id)!;
        Object.assign(item, data);
        return item;
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        state
          .filter((item) => matches(item, where))
          .forEach((item) => Object.assign(item, data));
        return { count: 1 };
      }),
      create: jest.fn(async ({ data }) => {
        const item = { ...branch(3), ...data };
        state.push(item);
        return item;
      }),
    },
    novaPostWarehouse: { findFirst: jest.fn().mockResolvedValue({ id: 3 }) },
  };
  const prisma = {
    ...tx,
    business: {
      findUnique: jest.fn().mockResolvedValue({ id: 3, isActive: true }),
    },
    customerProfile: {
      findFirst: jest.fn().mockResolvedValue({ id: 10, businessId: 3 }),
    },
    $transaction: jest.fn(async (callback) => callback(tx)),
  };
  const service = new CustomersService(
    prisma as unknown as PrismaService,
    {} as AuditService,
    {} as SupabaseService,
  );
  jest
    .spyOn(service, 'findOne')
    .mockImplementation(
      async () =>
        ({
          id: 10,
          novaPostAddresses: state.filter((item) => !item.archivedAt),
        }) as any,
    );
  return { state, tx, prisma, service };
}
function branch(id: number, isDefault = false, archivedAt: Date | null = null) {
  return {
    id,
    customerProfileId: 10,
    warehouseId: id,
    isDefault,
    archivedAt,
    warehouse: { isActive: true },
    destinationParcels: [{ id: 90 }],
    originParcels: [{ id: 91 }],
  };
}

describe('saved Nova Post address lifecycle', () => {
  it('requires an explicit eligible replacement and writes nothing on validation failure', async () => {
    const { service, tx } = setup();
    await expect(
      service.archiveNovaPostAddress(10, 1, 3),
    ).rejects.toMatchObject({
      response: { code: 'NOVA_POST_REPLACEMENT_REQUIRED' },
    });
    expect(tx.customerNovaPostAddress.update).not.toHaveBeenCalled();
    expect(tx.customerNovaPostAddress.updateMany).not.toHaveBeenCalled();
    await expect(
      service.archiveNovaPostAddress(10, 1, 3, 999),
    ).rejects.toMatchObject({
      response: { code: 'NOVA_POST_REPLACEMENT_REQUIRED' },
    });
  });
  it('archives a used branch and transfers preference inside the same transaction without touching parcel references', async () => {
    const { service, state, prisma, tx } = setup();
    await service.archiveNovaPostAddress(10, 1, 3, 2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.calls[0][0].strings.join('')).toContain(
      'FOR UPDATE',
    );
    expect(state[0]).toMatchObject({
      archivedAt: expect.any(Date),
      isDefault: false,
      destinationParcels: [{ id: 90 }],
      originParcels: [{ id: 91 }],
    });
    expect(state[1].isDefault).toBe(true);
    await service.archiveNovaPostAddress(10, 1, 3);
    expect(tx.customerNovaPostAddress.update).toHaveBeenCalledTimes(2);
  });
  it('can archive the last usable branch without inventing a replacement', async () => {
    const { service, state } = setup([branch(1, true)]);
    await service.archiveNovaPostAddress(10, 1, 3);
    expect(state[0].archivedAt).toBeInstanceOf(Date);
    expect(state[0].isDefault).toBe(false);
  });
  it('rejects a branch owned by a different customer or business', async () => {
    const { service, tx } = setup();
    await expect(
      service.archiveNovaPostAddress(10, 999, 3),
    ).rejects.toMatchObject({ status: 404 });
    tx.$queryRaw.mockResolvedValueOnce([]);
    await expect(
      service.restoreNovaPostAddress(10, 1, 99),
    ).rejects.toMatchObject({ status: 404 });
    expect(tx.customerNovaPostAddress.update).not.toHaveBeenCalled();
  });
  it('restores the same record, preserves an existing preferred branch, and is idempotent', async () => {
    const { service, state, tx } = setup([
      branch(1, true),
      branch(2, false, new Date()),
    ]);
    await service.restoreNovaPostAddress(10, 2, 3);
    expect(state[1]).toMatchObject({
      id: 2,
      archivedAt: null,
      isDefault: false,
    });
    expect(state[0].isDefault).toBe(true);
    await service.restoreNovaPostAddress(10, 2, 3);
    expect(tx.customerNovaPostAddress.update).toHaveBeenCalledTimes(1);
  });
  it('makes a restored branch preferred if no usable preferred branch exists', async () => {
    const { service, state } = setup([branch(1, false, new Date())]);
    await service.restoreNovaPostAddress(10, 1, 3);
    expect(state[0]).toMatchObject({ archivedAt: null, isDefault: true });
  });
  it('blocks restoring an inactive warehouse and preferring an archived branch', async () => {
    const { service, state } = setup([branch(1, false, new Date())]);
    state[0].warehouse.isActive = false;
    await expect(
      service.restoreNovaPostAddress(10, 1, 3),
    ).rejects.toMatchObject({
      response: { code: 'NOVA_POST_WAREHOUSE_INACTIVE' },
    });
    await expect(
      service.setDefaultNovaPostAddress(10, 1, 3),
    ).rejects.toMatchObject({
      response: { code: 'NOVA_POST_ADDRESS_UNAVAILABLE' },
    });
  });
  it('returns the archived duplicate ID instead of creating or implicitly restoring it', async () => {
    const { service, tx, state } = setup([branch(1, false, new Date())]);
    await expect(
      service.addNovaPostAddress(10, { warehouseId: 1 }, 3),
    ).rejects.toMatchObject({
      response: { code: 'NOVA_POST_ADDRESS_ARCHIVED', savedAddressId: 1 },
    });
    expect(tx.customerNovaPostAddress.create).not.toHaveBeenCalled();
    expect(state[0].archivedAt).toBeInstanceOf(Date);
  });
  it('only returns the requested archived state from the archive listing', async () => {
    const { service } = setup([branch(1, true), branch(2, false, new Date())]);
    expect(await service.getNovaPostAddresses(10, 3, true)).toEqual([
      expect.objectContaining({ id: 2 }),
    ]);
    expect(await service.getNovaPostAddresses(10, 3, false)).toEqual([
      expect.objectContaining({ id: 1 }),
    ]);
  });
});
