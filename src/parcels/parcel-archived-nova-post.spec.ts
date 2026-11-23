import { ParcelsService } from './parcels.service';
import { ParcelDestinationType } from '@prisma/client';

function setup() {
  const saved = { id: 20, warehouseId: 30, archivedAt: new Date() };
  const tx = {
    novaPostWarehouse: {
      findFirst: jest
        .fn()
        .mockResolvedValue({
          id: 30,
          externalRef: 'warehouse',
          cityName: 'Львів',
          name: 'Відділення №3',
          warehouseNumber: '3',
        }),
    },
    customerProfile: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ firstName: 'Олена', lastName: 'Коваль' }),
    },
    country: { findUnique: jest.fn().mockResolvedValue({ id: 1 }) },
    customerNovaPostAddress: {
      findFirst: jest.fn().mockResolvedValue(saved),
      findUnique: jest.fn().mockResolvedValue(saved),
      upsert: jest.fn(),
    },
  };
  const resolve = (ParcelsService.prototype as any).resolveParcelLocation.bind(
    {},
  );
  return { tx, resolve };
}
describe('archived Nova Post parcel selection', () => {
  it('rejects a stale archived saved-address ID instead of assigning it to a new parcel', async () => {
    const { tx, resolve } = setup();
    await expect(
      resolve(
        tx,
        {
          type: ParcelDestinationType.NovaPostWarehouse,
          warehouseId: 30,
          customerNovaPostAddressId: 20,
        },
        10,
        3,
        '+380671234567',
        'Destination',
      ),
    ).rejects.toMatchObject({
      response: { code: 'NOVA_POST_ADDRESS_ARCHIVED', savedAddressId: 20 },
    });
    expect(tx.customerNovaPostAddress.upsert).not.toHaveBeenCalled();
  });
  it('does not silently reactivate an archived branch through save-to-customer upsert', async () => {
    const { tx, resolve } = setup();
    await expect(
      resolve(
        tx,
        {
          type: ParcelDestinationType.NovaPostWarehouse,
          warehouseId: 30,
          saveToCustomerProfile: true,
        },
        10,
        3,
        '+380671234567',
        'Origin',
      ),
    ).rejects.toMatchObject({
      response: { code: 'NOVA_POST_ADDRESS_ARCHIVED', savedAddressId: 20 },
    });
    expect(tx.customerNovaPostAddress.upsert).not.toHaveBeenCalled();
  });
});
