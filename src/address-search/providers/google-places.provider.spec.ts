import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GooglePlacesProvider } from './google-places.provider';
const sessionToken = '87fb36cb-5de1-48fa-a7eb-d3f14c64ca26';
const config = {
  GOOGLE_PLACES_ENABLED: 'true',
  GOOGLE_PLACES_API_KEY: 'test-key',
  ADDRESS_LOOKUP_TIMEOUT_MS: 50,
};
const component = (type: string, longText: string, shortText?: string) => ({
  types: [type],
  longText,
  shortText,
});
const payload = (country = 'GB') => ({
  id: 'place-1',
  addressComponents: [
    component('country', country, country),
    component('route', country === 'GB' ? 'Downing Street' : 'Шевченка'),
    component('street_number', '10'),
    component('locality', 'Locality'),
    component('postal_town', 'London'),
    component('administrative_area_level_1', 'Львівська область'),
    component('administrative_area_level_2', 'Greater London'),
    component('postal_code', country === 'GB' ? 'sw1a2aa' : '79000'),
  ],
  attributions: [
    { provider: 'Source', providerUri: 'https://example.com/' },
    { provider: 'Unsafe', providerUri: 'javascript:alert(1)' },
  ],
});
function response(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response;
}
afterEach(() => jest.restoreAllMocks());
describe('Google Places country-aware addresses', () => {
  it.each([
    ['GB', 'uk', 'en'],
    ['UA', 'ua', 'uk'],
  ] as const)(
    'restricts %s predictions and requests only necessary fields',
    async (countryCode, regionCode, languageCode) => {
      const fetch = jest.spyOn(global, 'fetch').mockResolvedValue(
        response({
          suggestions: [
            {
              placePrediction: {
                placeId: 'place-1',
                text: { text: '10 Street' },
                types: ['street_address'],
              },
            },
            {
              placePrediction: {
                placeId: 'poi',
                text: { text: 'Cafe' },
                types: ['establishment', 'point_of_interest'],
              },
            },
          ],
        }),
      );
      const provider = new GooglePlacesProvider(new ConfigService(config));
      expect(
        await provider.search('Street', { countryCode, sessionToken }),
      ).toEqual([{ id: 'place-1', label: '10 Street' }]);
      const [url, options] = fetch.mock.calls[0];
      expect(String(url)).toBe(
        'https://places.googleapis.com/v1/places:autocomplete',
      );
      expect(JSON.parse(options!.body as string)).toEqual({
        input: 'Street',
        sessionToken,
        includedRegionCodes: [regionCode],
        languageCode,
        regionCode,
        includeQueryPredictions: false,
      });
      expect(options!.headers).toMatchObject({
        'X-Goog-Api-Key': 'test-key',
        'X-Goog-FieldMask':
          'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.types',
      });
    },
  );
  it('maps UK postal components without inventing UPRN or coordinates', async () => {
    const fetch = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(response(payload()));
    const provider = new GooglePlacesProvider(new ConfigService(config));
    expect(
      await provider.retrieve('place-1', { countryCode: 'GB', sessionToken }),
    ).toMatchObject({
      countryCode: 'GB',
      line1: '10 Downing Street',
      line2: null,
      city: 'London',
      county: 'Greater London',
      postcode: 'SW1A 2AA',
      uprn: null,
      latitude: null,
      longitude: null,
      provider: 'google-places',
      providerRef: 'place-1',
      attributions: [{ displayName: 'Source', uri: 'https://example.com/' }],
    });
    const url = new URL(String(fetch.mock.calls[0][0]));
    expect(url.searchParams.get('sessionToken')).toBe(sessionToken);
    expect(url.searchParams.get('languageCode')).toBe('en');
    expect(url.searchParams.get('regionCode')).toBe('uk');
    expect(fetch.mock.calls[0][1]!.headers).toMatchObject({
      'X-Goog-FieldMask': 'id,addressComponents,attributions',
    });
  });
  it('preserves flats and named buildings in UK address lines', async () => {
    const details = payload();
    details.addressComponents.push(
      component('subpremise', 'Flat 2'),
      component('premise', 'Rose House'),
    );
    jest.spyOn(global, 'fetch').mockResolvedValue(response(details));
    const provider = new GooglePlacesProvider(new ConfigService(config));
    expect(
      await provider.retrieve('place-1', { countryCode: 'GB', sessionToken }),
    ).toMatchObject({
      line1: 'Flat 2',
      line2: 'Rose House',
      line3: '10 Downing Street',
    });
  });
  it('preserves Ukrainian mapping and default direct-provider country behavior', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(response(payload('UA')));
    const provider = new GooglePlacesProvider(new ConfigService(config));
    expect(await provider.retrieve('place-1', { sessionToken })).toMatchObject({
      countryCode: 'UA',
      street: 'Шевченка',
      building: '10',
      city: 'Locality',
      region: 'Львівська область',
      postcode: '79000',
    });
  });
  it('returns partial UK fields for manual completion', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      response({
        id: 'place-1',
        addressComponents: [
          component('country', 'United Kingdom', 'GB'),
          component('postal_code', 'sw1a2aa'),
        ],
      }),
    );
    const provider = new GooglePlacesProvider(new ConfigService(config));
    expect(
      await provider.retrieve('place-1', { countryCode: 'GB', sessionToken }),
    ).toMatchObject({
      line1: '',
      city: '',
      postcode: 'SW1A 2AA',
      attributions: [],
    });
  });
  it.each(['UA', 'GB'] as const)(
    'accepts canonicalized %s Place IDs and preserves the returned provider reference',
    async (countryCode) => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(
          response({ ...payload(countryCode), id: 'canonical-place' }),
        );
      const provider = new GooglePlacesProvider(new ConfigService(config));
      expect(
        await provider.retrieve('autocomplete-place', {
          countryCode,
          sessionToken,
        }),
      ).toMatchObject({
        countryCode,
        provider: 'google-places',
        providerRef: 'canonical-place',
        ...(countryCode === 'UA'
          ? { street: 'Шевченка', building: '10', city: 'Locality' }
          : { line1: '10 Downing Street' }),
      });
    },
  );
  it('rejects country mismatch before exposing resolved fields', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(response(payload('UA')));
    await expect(
      new GooglePlacesProvider(new ConfigService(config)).retrieve('place-1', {
        countryCode: 'GB',
        sessionToken,
      }),
    ).rejects.toThrow(BadRequestException);
  });
  it('rejects missing IDs and malformed detail components', async () => {
    const fetch = jest.spyOn(global, 'fetch');
    const provider = new GooglePlacesProvider(new ConfigService(config));
    for (const body of [
      { ...payload(), id: undefined },
      { ...payload(), id: '   ' },
      { ...payload(), addressComponents: [{}] },
    ]) {
      fetch.mockResolvedValueOnce(response(body));
      await expect(
        provider.retrieve('place-1', { countryCode: 'GB', sessionToken }),
      ).rejects.toThrow(BadGatewayException);
    }
  });
  it('requires a UUID session token for both countries', async () => {
    const fetch = jest.spyOn(global, 'fetch');
    const provider = new GooglePlacesProvider(new ConfigService(config));
    for (const countryCode of ['GB', 'UA'] as const) {
      await expect(provider.search('Street', { countryCode })).rejects.toThrow(
        BadRequestException,
      );
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it('fails safely when disabled', async () => {
    const fetch = jest.spyOn(global, 'fetch');
    await expect(
      new GooglePlacesProvider(
        new ConfigService({ ...config, GOOGLE_PLACES_ENABLED: 'false' }),
      ).search('Street', { countryCode: 'GB', sessionToken }),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([401, 403, 429, 500])(
    'normalizes provider HTTP %s without exposing its payload',
    async (status) => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(
          response({ error: { message: 'private provider details' } }, status),
        );
      const error = await new GooglePlacesProvider(new ConfigService(config))
        .search('Street', { countryCode: 'GB', sessionToken })
        .catch((failure) => failure);
      expect(error).toBeInstanceOf(HttpException);
      expect(error.message).not.toContain('private provider details');
    },
  );
  it('aborts requests at the configured timeout', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options!.signal!.addEventListener('abort', () =>
            reject(new Error('aborted')),
          );
        }),
    );
    await expect(
      new GooglePlacesProvider(
        new ConfigService({ ...config, ADDRESS_LOOKUP_TIMEOUT_MS: 5 }),
      ).search('Street', { countryCode: 'GB', sessionToken }),
    ).rejects.toThrow(GatewayTimeoutException);
  });
});
