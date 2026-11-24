import { DeliveryStatus, JourneyStatus, UserType } from '@prisma/client';
import { ParcelsService } from './parcels.service';

const manager: any = {
  id: 7,
  businessId: 3,
  type: UserType.Manager,
  isAdmin: false,
  isSuperAdmin: false,
};
function setup(status: JourneyStatus = JourneyStatus.InTransit) {
  let previous: any = null;
  const saved: any[] = [];
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    user: {
      findFirst: jest.fn().mockResolvedValue({
        id: 91,
        driverProfile: { id: 51 },
        courierProfile: { id: 61 },
      }),
    },
    parcelCreationRequest: {
      findUnique: jest.fn().mockImplementation(async () => previous),
      create: jest.fn().mockImplementation(async ({ data }) => {
        previous = data;
        return data;
      }),
    },
    shipment: { create: jest.fn().mockResolvedValue({}) },
    journey: {
      findFirst: jest.fn().mockResolvedValue({
        status,
        isCompleted: false,
        isArchived: false,
        startCountryId: 1,
        endCountryId: 2,
        driverProfiles: [{ id: 51 }],
      }),
    },
    parcel: {
      create: jest.fn().mockImplementation(async ({ data }) => {
        const row = { ...data, id: saved.length + 1, updatedAt: new Date() };
        saved.push(row);
        return row;
      }),
      update: jest.fn().mockImplementation(async ({ where, data }) => ({
        ...saved.find((row) => row.id === where.id),
        ...data,
        pickedUpByUser:
          saved.find((row) => row.id === where.id).pickedUpByUserId === 7
            ? { id: 7, firstName: 'Олена', lastName: 'Менеджер' }
            : { id: 91, firstName: 'Ірина', lastName: 'Кур’єр' },
        pickedUpByCourier: {
          user: { id: 91, firstName: 'Ірина', lastName: 'Кур’єр' },
        },
      })),
      findMany: jest.fn().mockImplementation(async () => saved),
    },
    parcelPrice: { create: jest.fn().mockResolvedValue({ id: 201 }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const service: any = Object.create(ParcelsService.prototype);
  service.prismaService = {
    $transaction: jest.fn().mockImplementation(async (action) => action(tx)),
  };
  service.auditService = { log: jest.fn().mockResolvedValue({}) };
  service.tariffsService = {
    findEligibleTariff: jest.fn().mockResolvedValue({
      id: 1,
      business: { currency: 'GBP' },
      tariffGroup: { id: 2 },
      name: 'Стандарт',
      pricingType: 'Fixed',
      minimumPrice: 25,
    }),
    calculateTariffAmount: jest.fn().mockReturnValue(25),
  };
  service.validateBusinessAccess = jest.fn().mockResolvedValue(undefined);
  service.validateParcelProfiles = jest.fn().mockResolvedValue({
    senderPhoneNumber: '+44111',
    recipientPhoneNumber: '+380222',
  });
  service.resolveUserProfile = jest.fn().mockResolvedValue({ driverId: 51 });
  service.resolveParcelLocation = jest
    .fn()
    .mockImplementation(
      async (_tx, _location, _id, _business, _phone, side) => ({
        countryId: side === 'Origin' ? 1 : 2,
        countryIsoCode: side === 'Origin' ? 'UA' : 'GB',
        snapshot: {
          type: 'CustomerAddress',
          countryIsoCode: side === 'Origin' ? 'UA' : 'GB',
          postcode: side === 'Origin' ? undefined : 'SW1A 1AA',
        },
      }),
    );
  service.toOriginData = jest
    .fn()
    .mockReturnValue({ originType: 'CustomerAddress' });
  service.toDestinationData = jest
    .fn()
    .mockReturnValue({ destinationType: 'CustomerAddress' });
  service.generateTrackingNumber = jest.fn().mockResolvedValue('SLV-001');
  const body: any = {
    senderId: 1,
    recipientId: 2,
    origin: { type: 'CustomerAddress', addressId: 11 },
    destination: { type: 'CustomerAddress', addressId: 21 },
    journeyId: 11,
    parcels: [{ weight: 25, parcelType: 'Regular', tariffId: 1 }],
  };
  return { service, tx, saved, body };
}

describe('transactional creation with independent pickup metadata', () => {
  it('fixes pickup identity for old driver requests on active journeys without downgrading status', async () => {
    const { service, saved, body, tx } = setup();
    const result = await service.createBulk(
      { ...manager, type: UserType.InternationalDriver },
      body,
      'legacy-driver-key',
    );
    expect(saved[0]).toMatchObject({
      deliveryStatus: DeliveryStatus.InTransit,
      pickedUpByDriverId: 51,
      pickedUpByCourierId: null,
      pickedUpAt: expect.any(Date),
    });
    expect(result[0].deliveryStatus).toBe(DeliveryStatus.InTransit);
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 7,
          metadata: expect.objectContaining({ eventType: 'ParcelPickedUp' }),
        }),
      }),
    );
  });
  it('records the selected courier, timestamp and recorder separately for a staff-created group', async () => {
    const { service, saved, body, tx } = setup();
    const pickup = {
      collector: { type: 'Courier', profileId: 61 },
      pickedUpAt: '2026-01-01T10:00:00+02:00',
    };
    body.parcels = [
      { ...body.parcels[0], pickup },
      { ...body.parcels[0], pickup },
    ];
    const result = await service.createBulk(manager, body, 'staff-create-key');
    for (const row of saved)
      expect(row).toMatchObject({
        deliveryStatus: DeliveryStatus.InTransit,
        pickedUpByCourierId: 61,
        pickedUpByDriverId: null,
        pickedUpAt: new Date('2026-01-01T08:00:00Z'),
      });
    expect(result[0].pickedUpBy).toMatchObject({ id: 91, firstName: 'Ірина' });
    const pickupEvents = tx.auditLog.create.mock.calls.filter(
      ([arg]) => arg.data.metadata.eventType === 'ParcelPickedUp',
    );
    expect(pickupEvents).toHaveLength(2);
    expect(pickupEvents[0][0].data).toMatchObject({
      userId: 7,
      metadata: {
        details: {
          pickedUpByCourierId: 61,
          pickedUpAt: '2026-01-01T08:00:00.000Z',
          deliveryStatus: 'InTransit',
        },
      },
    });
    const calls = tx.auditLog.create.mock.calls.length;
    const replay = await service.createBulk(manager, body, 'staff-create-key');
    expect(replay.map((row) => row.id)).toEqual(result.map((row) => row.id));
    expect(tx.parcel.create).toHaveBeenCalledTimes(2);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(calls);
  });
  it('defaults staff pickup to the creator while keeping active journey status', async () => {
    const { service, saved, body } = setup();
    await service.createBulk(manager, body);
    expect(saved[0]).toMatchObject({
      deliveryStatus: DeliveryStatus.InTransit,
      pickedUpAt: expect.any(Date),
      pickedUpByUserId: 7,
      pickedUpByDriverId: null,
      pickedUpByCourierId: null,
    });
  });
  it.each(['PickedUp', 'AtOriginWarehouse', 'AwaitingPickup'])(
    'defaults pickup only when collection already occurred: %s',
    async (status) => {
      const { service, body, saved } = setup(JourneyStatus.Scheduled);
      body.parcels[0].initialDeliveryStatus = status;
      const result = await service.createBulk(manager, body);
      expect(saved[0].deliveryStatus).toBe(status);
      if (status === 'AwaitingPickup')
        expect(saved[0].pickedUpByUserId).toBeNull();
      else {
        expect(saved[0].pickedUpByUserId).toBe(7);
        expect(result[0].pickedUpBy).toMatchObject({ id: 7 });
      }
    },
  );
  it('rejects an unavailable collector before parcel writes or idempotency completion', async () => {
    const { service, tx, body } = setup();
    tx.user.findFirst.mockResolvedValue(null);
    body.parcels[0].pickup = { collector: { type: 'Driver', profileId: 99 } };
    await expect(
      service.createBulk(manager, body, 'invalid-collector-key'),
    ).rejects.toMatchObject({
      response: { code: 'PICKUP_COLLECTOR_UNAVAILABLE' },
    });
    expect(tx.parcel.create).not.toHaveBeenCalled();
    expect(tx.parcelCreationRequest.create).not.toHaveBeenCalled();
  });
  it('supports staff-confirmed pickup on a scheduled journey without pretending the staff member collected it', async () => {
    const { service, saved, body } = setup(JourneyStatus.Scheduled);
    body.parcels[0].initialDeliveryStatus = 'PickedUp';
    body.parcels[0].pickup = { collector: { type: 'Driver', profileId: 51 } };
    await service.createBulk(manager, body);
    expect(saved[0]).toMatchObject({
      deliveryStatus: DeliveryStatus.PickedUp,
      pickedUpByDriverId: 51,
      pickedUpAt: expect.any(Date),
    });
  });
  it('preserves the restriction against couriers adding parcels to active journeys', async () => {
    const { service, body } = setup();
    service.resolveUserProfile.mockResolvedValue({ courierId: 61 });
    await expect(
      service.createBulk({ ...manager, type: UserType.ParcelCourier }, body),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('rejects completed pickup details for a parcel still awaiting pickup', async () => {
    const { service, body } = setup(JourneyStatus.Scheduled);
    body.parcels[0].initialDeliveryStatus = 'AwaitingPickup';
    body.parcels[0].pickup = { collector: { type: 'Driver', profileId: 51 } };
    await expect(service.createBulk(manager, body)).rejects.toMatchObject({
      response: { code: 'PICKUP_INCOMPATIBLE_STATUS' },
    });
  });
  it('forwards the pickup contract through single-parcel creation', async () => {
    const { service, body } = setup();
    const pickup = { collector: { type: 'Courier', profileId: 61 } };
    service.createBulk = jest.fn().mockResolvedValue([{ id: 1 }]);
    await service.createParcel(
      manager,
      { ...body, ...body.parcels[0], pickup },
      'single-pickup-key',
    );
    expect(service.createBulk.mock.calls[0][1].parcels[0].pickup).toEqual(
      pickup,
    );
  });
});
