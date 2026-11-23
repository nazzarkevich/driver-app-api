import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CustomersService } from './customers.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from 'src/audit/audit.service';
import { SupabaseService } from 'src/supabase/supabase.service';
import {
  ReplaceCustomerNovaPostAddressDto,
  UpdateCustomerNovaPostAddressDto,
} from './dtos/customer-nova-post-address.dto';

const branch = (id: number, preferred = false) => ({
  id,
  customerProfileId: 10,
  warehouseId: id,
  isDefault: preferred,
  archivedAt: null as Date | null,
  label: `Branch ${id}` as string | null,
  note: 'Source instructions' as string | null,
  recipientPhone: '123' as string | null,
  parcelIds: [90],
});
function setup() {
  const state = [branch(1, true), branch(2)];
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 10 }]),
    novaPostWarehouse: {
      findFirst: jest
        .fn()
        .mockImplementation(async ({ where }) => ({ id: where.id })),
    },
    customerNovaPostAddress: {
      findFirst: jest.fn(
        async ({ where }) =>
          state.find(
            (item) =>
              item.id === where.id &&
              item.customerProfileId === where.customerProfileId,
          ) ?? null,
      ),
      findUnique: jest.fn(
        async ({ where }) =>
          state.find(
            (item) =>
              item.customerProfileId ===
                where.customerProfileId_warehouseId.customerProfileId &&
              item.warehouseId ===
                where.customerProfileId_warehouseId.warehouseId,
          ) ?? null,
      ),
      create: jest.fn(async ({ data }) => {
        const item = {
          ...branch(3),
          note: null,
          recipientPhone: null,
          parcelIds: [],
          ...data,
        };
        state.push(item);
        return item;
      }),
      updateMany: jest.fn(async ({ data }) => {
        state
          .filter((item) => item.isDefault)
          .forEach((item) => Object.assign(item, data));
        return { count: 1 };
      }),
      update: jest.fn(async ({ where, data }) => {
        const item = state.find((item) => item.id === where.id)!;
        Object.assign(item, data);
        return item;
      }),
    },
  };
  const prisma = {
    ...tx,
    business: {
      findUnique: jest.fn().mockResolvedValue({ id: 3, isActive: true }),
    },
    $transaction: jest.fn(async (callback) => {
      const before = structuredClone(state);
      try {
        return await callback(tx);
      } catch (error) {
        state.splice(0, state.length, ...before);
        throw error;
      }
    }),
  };
  const service = new CustomersService(
    prisma as unknown as PrismaService,
    {} as AuditService,
    {} as SupabaseService,
  );
  jest.spyOn(service, 'findOne').mockImplementation(
    async () =>
      ({
        id: 10,
        novaPostAddresses: state.filter((item) => !item.archivedAt),
      }) as any,
  );
  return { state, tx, prisma, service };
}

describe('Nova Post replacement', () => {
  it('creates a new preferred target and archives the original without rewriting its warehouse, metadata or parcel references', async () => {
    const { state, service, prisma } = setup();
    const result = await service.replaceNovaPostAddress(
      10,
      1,
      { warehouseId: 3, label: ' Work ' },
      3,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(state[0]).toMatchObject({
      warehouseId: 1,
      label: 'Branch 1',
      note: 'Source instructions',
      recipientPhone: '123',
      parcelIds: [90],
      isDefault: false,
      archivedAt: expect.any(Date),
    });
    expect(state[2]).toMatchObject({
      warehouseId: 3,
      label: 'Work',
      isDefault: true,
      note: null,
      recipientPhone: null,
    });
    expect(result.replacementAddressId).toBe(3);
  });
  it('reuses an existing active target and preserves its label and metadata', async () => {
    const { state, service, tx } = setup();
    const result = await service.replaceNovaPostAddress(
      10,
      1,
      { warehouseId: 2, label: 'Do not overwrite' },
      3,
    );
    expect(result.replacementAddressId).toBe(2);
    expect(tx.customerNovaPostAddress.create).not.toHaveBeenCalled();
    expect(state[1]).toMatchObject({
      label: 'Branch 2',
      note: 'Source instructions',
      isDefault: true,
    });
  });
  it('preserves the preferred branch when replacing a nonpreferred source', async () => {
    const { state, service } = setup();
    await service.replaceNovaPostAddress(10, 2, { warehouseId: 3 }, 3);
    expect(state[0].isDefault).toBe(true);
    expect(state[2].isDefault).toBe(false);
  });
  it.each(['source', 'target', 'same', 'inactive', 'missing'] as const)(
    'rejects an invalid %s before making changes',
    async (kind) => {
      const { state, service, tx } = setup();
      if (kind === 'source') state[0].archivedAt = new Date();
      if (kind === 'target') state[1].archivedAt = new Date();
      if (kind === 'inactive')
        tx.novaPostWarehouse.findFirst.mockResolvedValue(null);
      const before = structuredClone(state);
      await expect(
        service.replaceNovaPostAddress(
          10,
          kind === 'missing' ? 999 : 1,
          { warehouseId: kind === 'same' ? 1 : 2 },
          3,
        ),
      ).rejects.toBeDefined();
      expect(state).toEqual(before);
      expect(tx.customerNovaPostAddress.create).not.toHaveBeenCalled();
      expect(tx.customerNovaPostAddress.update).not.toHaveBeenCalled();
    },
  );
  it('checks the business-scoped customer lock before reading or mutating saved addresses', async () => {
    const { service, tx } = setup();
    tx.$queryRaw.mockResolvedValueOnce([]);
    await expect(
      service.replaceNovaPostAddress(10, 1, { warehouseId: 3 }, 99),
    ).rejects.toMatchObject({ status: 404 });
    expect(tx.customerNovaPostAddress.findFirst).not.toHaveBeenCalled();
  });
  it('keeps target creation and preference changes inside the same rollback boundary as source archiving', async () => {
    const { state, service, tx } = setup();
    const before = structuredClone(state);
    const update = tx.customerNovaPostAddress.update.getMockImplementation()!;
    tx.customerNovaPostAddress.update.mockImplementation(async (args) => {
      if (args.data.archivedAt) throw new Error('archive failed');
      return update(args);
    });
    await expect(
      service.replaceNovaPostAddress(10, 1, { warehouseId: 3 }, 3),
    ).rejects.toThrow('archive failed');
    expect(state).toEqual(before);
  });
  it('rejects a repeated stale source instead of creating another target', async () => {
    const { service, tx } = setup();
    await service.replaceNovaPostAddress(10, 1, { warehouseId: 3 }, 3);
    await expect(
      service.replaceNovaPostAddress(10, 1, { warehouseId: 3 }, 3),
    ).rejects.toMatchObject({
      response: { code: 'NOVA_POST_SOURCE_ARCHIVED' },
    });
    expect(tx.customerNovaPostAddress.create).toHaveBeenCalledTimes(1);
  });
  it.each([' New label ', '', '   ', null])(
    'supports editing and clearing label %s through the DTO and persisted write',
    async (label) => {
      const values = plainToInstance(UpdateCustomerNovaPostAddressDto, {
        label,
      });
      expect(validateSync(values)).toEqual([]);
      const { service, state } = setup();
      await service.updateNovaPostAddress(10, 1, values, 3);
      expect(state[0].label).toBe(
        typeof label === 'string' ? label.trim() || null : null,
      );
    },
  );
  it('keeps warehouse identity immutable even if an internal metadata update contains unexpected fields', async () => {
    const { service, state } = setup();
    await service.updateNovaPostAddress(
      10,
      1,
      { label: 'Work', warehouseId: 99 } as any,
      3,
    );
    expect(state[0].warehouseId).toBe(1);
    expect(state[0].label).toBe('Work');
  });
  it('validates replacement warehouse IDs and rejects non-string labels', () => {
    expect(
      validateSync(
        plainToInstance(ReplaceCustomerNovaPostAddressDto, { warehouseId: 0 }),
      ),
    ).not.toEqual([]);
    expect(
      validateSync(
        plainToInstance(UpdateCustomerNovaPostAddressDto, { label: 123 }),
      ),
    ).not.toEqual([]);
  });
});
