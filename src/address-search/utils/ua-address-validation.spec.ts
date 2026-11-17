import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAddressDto } from 'src/dtos/create-address.dto';
import { AddAddressDto } from 'src/addresses/dtos/add-address.dto';
import { CreateCustomerProfileDto } from 'src/profiles/customers/dtos/create-customer-profile.dto';
import { CustomersService } from 'src/profiles/customers/customers.service';
import { AddressesService } from 'src/addresses/addresses.service';
import { addressStreet, validateUkraineAddress } from './address-metadata';

describe('optional Ukrainian street validation', () => {
  for (const Dto of [CreateAddressDto, AddAddressDto]) {
    it(`${Dto.name} accepts Ukrainian city/village addresses without a street`, async () => {
      for (const location of [{ city: 'Львів' }, { village: 'Верхня Білка' }]) {
        for (const street of [{}, { street: '', line1: '' }]) {
          const address = { countryIsoCode: 'UA', ...location, ...street };
          expect(
            await validate(plainToInstance(Dto as any, address) as object),
          ).toEqual([]);
          expect(() => validateUkraineAddress(address)).not.toThrow();
          expect(addressStreet(address)).toBe('');
        }
      }
    });
    it(`${Dto.name} retains UK street requirements and provided-field types`, async () => {
      expect(
        (
          await validate(
            plainToInstance(Dto as any, {
              countryIsoCode: 'GB',
              city: 'London',
              postcode: 'SW1A 1AA',
            }) as object,
          )
        ).length,
      ).toBeGreaterThan(0);
      for (const street of [
        { street: '10 High Street' },
        { line1: '10 High Street' },
      ]) {
        expect(
          await validate(
            plainToInstance(Dto as any, {
              countryIsoCode: 'GB',
              city: 'London',
              postcode: 'SW1A 1AA',
              ...street,
            }) as object,
          ),
        ).toEqual([]);
      }
      expect(
        (
          await validate(
            plainToInstance(Dto as any, {
              countryIsoCode: 'UA',
              village: 'Село',
              street: 123,
            }) as object,
          )
        ).length,
      ).toBeGreaterThan(0);
    });
  }
  it('accepts a village-only address nested in customer creation', async () => {
    const customer = plainToInstance(CreateCustomerProfileDto, {
      firstName: 'Олена',
      lastName: 'Коваль',
      phoneNumber: { countryCode: '+380', number: '501234567' },
      addresses: [{ countryIsoCode: 'UA', village: 'Верхня Білка' }],
    });
    expect(await validate(customer)).toEqual([]);
  });
  it('retains Ukrainian settlement and optional postcode validation', () => {
    for (const address of [
      { countryIsoCode: 'UA' },
      { countryIsoCode: 'UA', city: ' ', village: ' ', street: 'Вулиця' },
      { countryIsoCode: 'UA', village: 'Село', postcode: '1234' },
    ])
      expect(() => validateUkraineAddress(address)).toThrow();
    expect(() =>
      validateUkraineAddress({
        countryIsoCode: 'UA',
        village: 'Село',
        postcode: '79000',
      }),
    ).not.toThrow();
  });
});

function setup() {
  const tx = {
    phone: { create: jest.fn().mockResolvedValue({ id: 20 }) },
    customerProfile: {
      create: jest.fn().mockResolvedValue({ id: 100 }),
      findFirst: jest.fn().mockResolvedValue({ id: 100 }),
    },
    address: {
      createMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn(),
    },
  };
  const prisma = {
    business: {
      findUnique: jest.fn().mockResolvedValue({ id: 3, isActive: true }),
    },
    country: {
      findMany: jest.fn().mockResolvedValue([{ id: 1, isoCode: 'UA' }]),
      findUnique: jest.fn().mockResolvedValue({ id: 1, isoCode: 'UA' }),
    },
    phone: { findUnique: jest.fn().mockResolvedValue(null) },
    customerProfile: {
      findUnique: jest.fn().mockResolvedValue({ businessId: 3, addresses: [] }),
    },
    $transaction: jest.fn(async (callback) => callback(tx)),
  };
  const customers = new CustomersService(prisma as any, {} as any, {} as any);
  jest.spyOn(customers, 'findOne').mockResolvedValue({ id: 100 } as any);
  return {
    prisma,
    tx,
    customers,
    addresses: new AddressesService(prisma as any),
  };
}
describe('village-only address persistence', () => {
  const address = { countryIsoCode: 'UA', village: 'Верхня Білка' };
  it('stores an empty street when creating a customer', async () => {
    const { customers, tx } = setup();
    await customers.createProfile(
      {
        firstName: 'Олена',
        lastName: 'Коваль',
        phoneNumber: { countryCode: '+380', number: '501234567' },
        addresses: [address],
      },
      3,
    );
    expect(tx.address.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          street: '',
          village: 'Верхня Білка',
          businessId: 3,
          profileId: 100,
          countryId: 1,
        }),
      ],
    });
  });
  it('stores an empty street when adding an address through customer details', async () => {
    const { customers, tx } = setup();
    await customers.addAddress(100, address, 3);
    expect(tx.address.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        street: '',
        village: 'Верхня Білка',
        businessId: 3,
        profileId: 100,
      }),
    });
  });
  it('stores an empty street through the address endpoint', async () => {
    const { addresses, tx } = setup();
    await addresses.createAddress({ ...address, profileId: 100 }, 3);
    expect(tx.address.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        street: '',
        village: 'Верхня Білка',
        businessId: 3,
        profileId: 100,
      }),
    });
  });
  it('rejects a Ukrainian address without a settlement before persistence', async () => {
    const { customers, prisma } = setup();
    await expect(
      customers.createProfile(
        {
          firstName: 'Олена',
          lastName: 'Коваль',
          phoneNumber: { countryCode: '+380', number: '501234567' },
          addresses: [{ countryIsoCode: 'UA', street: 'Вулиця' }],
        },
        3,
      ),
    ).rejects.toThrow();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
