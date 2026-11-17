import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddressSearchService } from './address-search.service';
import { SearchAddressDto } from './dto/search-address.dto';
import { validateAddressMetadata } from './utils/address-metadata';
const token = '87fb36cb-5de1-48fa-a7eb-d3f14c64ca26';
function setup() {
  const ideal = {
    search: jest.fn().mockResolvedValue([{ id: 'ideal', label: 'UK' }]),
    retrieve: jest.fn().mockResolvedValue({ provider: 'ideal-postcodes' }),
  };
  const google = {
    search: jest.fn().mockResolvedValue([{ id: 'google', label: 'Address' }]),
    retrieve: jest.fn().mockResolvedValue({ provider: 'google-places' }),
  };
  const cache = { get: jest.fn(), set: jest.fn() };
  return {
    ideal,
    google,
    cache,
    service: new AddressSearchService(
      ideal,
      {} as any,
      cache as any,
      new ConfigService(),
      google as any,
    ),
  };
}
describe('address lookup provider routing and compatibility', () => {
  it('keeps default UK requests on the legacy provider and its cache', async () => {
    const { service, ideal, google, cache } = setup();
    await service.search('  High   Street  ');
    await service.retrieve('ideal');
    expect(ideal.search).toHaveBeenCalledWith('High Street');
    expect(ideal.retrieve).toHaveBeenCalledWith('ideal');
    expect(google.search).not.toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalledTimes(2);
  });
  it.each(['GB', 'UA'] as const)(
    'bypasses prediction/detail caching for explicit Google %s requests',
    async (countryCode) => {
      const { service, google, ideal, cache } = setup();
      const context = {
        countryCode,
        sessionToken: token,
        provider: 'google-places' as const,
      };
      await service.search('  Some  Street ', context);
      await service.retrieve('google', context);
      expect(google.search).toHaveBeenCalledWith('Some Street', context);
      expect(google.retrieve).toHaveBeenCalledWith('google', context);
      expect(ideal.search).not.toHaveBeenCalled();
      expect(cache.get).not.toHaveBeenCalled();
      expect(cache.set).not.toHaveBeenCalled();
    },
  );
  it('preserves Ukrainian tablet routing without the new provider parameter', async () => {
    const { service, google } = setup();
    await service.search('Шевченка', {
      countryCode: 'UA',
      sessionToken: token,
    });
    expect(google.search).toHaveBeenCalled();
  });
  it('validates Google session context without making session tokens mandatory for legacy UK callers', async () => {
    for (const query of [
      { query: 'Street' },
      {
        query: 'Street',
        countryCode: 'GB',
        provider: 'google-places',
        sessionToken: token,
      },
      { query: 'Вулиця', countryCode: 'UA', sessionToken: token },
    ])
      expect(await validate(plainToInstance(SearchAddressDto, query))).toEqual(
        [],
      );
    for (const query of [
      { query: 'Street', provider: 'google-places' },
      { query: 'Street', countryCode: 'UA' },
      { query: 'Street', provider: 'other', sessionToken: token },
      {
        query: 'Street',
        countryCode: 'FR',
        provider: 'google-places',
        sessionToken: token,
      },
      { query: 'Street', provider: 'google-places', sessionToken: 'bad' },
    ])
      expect(
        (await validate(plainToInstance(SearchAddressDto, query))).length,
      ).toBeGreaterThan(0);
  });
  it('accepts Google metadata for UK and Ukraine and retains manual and legacy UK support', () => {
    for (const country of ['GB', 'UA']) {
      expect(() =>
        validateAddressMetadata(country, {
          provider: 'google-places',
          providerRef: 'id',
        }),
      ).not.toThrow();
      expect(() => validateAddressMetadata(country, {})).not.toThrow();
    }
    expect(() =>
      validateAddressMetadata('GB', {
        provider: 'ideal-postcodes',
        providerRef: 'id',
      }),
    ).not.toThrow();
    expect(() =>
      validateAddressMetadata('UA', {
        provider: 'ideal-postcodes',
        providerRef: 'id',
      }),
    ).toThrow();
    expect(() =>
      validateAddressMetadata('GB', { provider: 'google-places' }),
    ).toThrow();
  });
});
