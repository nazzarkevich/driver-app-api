import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AddressLookupContext,
  AddressProvider,
} from './address-provider.interface';
import { AddressSuggestion } from '../types/address-suggestion';
import { ResolvedUkraineAddress } from '../types/resolved-address';

interface Component {
  types: string[];
  longText?: string;
  shortText?: string;
}
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const ADDRESS_PREDICTION_TYPES = new Set([
  'street_address',
  'premise',
  'subpremise',
  'route',
  'locality',
  'postal_town',
  'sublocality',
  'administrative_area_level_3',
  'administrative_area_level_4',
  'administrative_area_level_5',
  'administrative_area_level_6',
  'administrative_area_level_7',
]);

function isAddressPrediction(value: unknown): boolean {
  if (
    !Array.isArray(value) ||
    !value.every((type) => typeof type === 'string')
  ) {
    return false;
  }
  if (value.includes('point_of_interest') || value.includes('establishment')) {
    return false;
  }
  return (
    value.some((type) => ADDRESS_PREDICTION_TYPES.has(type)) ||
    (value.includes('political') && value.includes('geocode'))
  );
}

@Injectable()
export class GooglePlacesProvider implements AddressProvider {
  private readonly logger = new Logger(GooglePlacesProvider.name);
  constructor(private readonly config: ConfigService) {}

  async search(
    query: string,
    context: AddressLookupContext = {},
  ): Promise<AddressSuggestion[]> {
    const payload = await this.request(
      'autocomplete',
      this.sessionToken(context),
      query,
    );
    if (
      !isObject(payload) ||
      (payload.suggestions !== undefined && !Array.isArray(payload.suggestions))
    ) {
      throw new BadGatewayException(
        'Address provider returned an invalid response',
      );
    }
    // An empty object is Google's valid no-predictions response.
    return ((payload.suggestions ?? []) as unknown[]).flatMap((entry) => {
      if (!isObject(entry) || !isObject(entry.placePrediction))
        throw new BadGatewayException('Invalid address prediction');
      const prediction = entry.placePrediction;
      const id = text(prediction.placeId);
      const label = isObject(prediction.text)
        ? text(prediction.text.text)
        : null;
      if (!id || !label)
        throw new BadGatewayException('Invalid address prediction');
      return isAddressPrediction(prediction.types) ? [{ id, label }] : [];
    });
  }

  async retrieve(
    id: string,
    context: AddressLookupContext = {},
  ): Promise<ResolvedUkraineAddress> {
    const payload = await this.request(
      'details',
      this.sessionToken(context),
      id,
    );
    if (
      !isObject(payload) ||
      !Array.isArray(payload.addressComponents) ||
      text(payload.id) !== id
    ) {
      throw new BadGatewayException(
        'Address provider returned an invalid response',
      );
    }
    const components = payload.addressComponents;
    if (
      !components.every(
        (component) =>
          isObject(component) &&
          Array.isArray(component.types) &&
          component.types.every((type) => typeof type === 'string'),
      )
    ) {
      throw new BadGatewayException(
        'Address provider returned invalid components',
      );
    }
    const component = (type: string) =>
      (components as Component[]).find((item) => item.types.includes(type));
    if (component('country')?.shortText !== 'UA')
      throw new BadRequestException('Only Ukrainian addresses are supported');
    const value = (type: string) => text(component(type)?.longText);
    const attributions = Array.isArray(payload.attributions)
      ? payload.attributions
      : [];
    return {
      countryCode: 'UA',
      street: value('route'),
      building: value('street_number'),
      city: value('locality') ?? value('postal_town'),
      village: null,
      region: value('administrative_area_level_1'),
      postcode: value('postal_code'),
      provider: 'google-places',
      providerRef: id,
      attributions: attributions.flatMap((item) =>
        isObject(item) && text(item.provider) && text(item.providerUri)
          ? [
              {
                displayName: text(item.provider)!,
                uri: text(item.providerUri)!,
              },
            ]
          : [],
      ),
    };
  }

  private sessionToken(context: AddressLookupContext): string {
    if (
      !context.sessionToken ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        context.sessionToken,
      )
    ) {
      throw new BadRequestException(
        'A UUID v4 sessionToken is required for Ukrainian lookup',
      );
    }
    return context.sessionToken;
  }

  private async request(
    operation: 'autocomplete' | 'details',
    sessionToken: string,
    input: string,
  ): Promise<unknown> {
    const apiKey = this.config.get<string>('GOOGLE_PLACES_API_KEY', '');
    if (
      String(
        this.config.get('GOOGLE_PLACES_ENABLED', 'false'),
      ).toLowerCase() !== 'true' ||
      !apiKey
    ) {
      throw new ServiceUnavailableException(
        'Ukrainian address lookup is not configured',
      );
    }
    const url = new URL(
      operation === 'autocomplete'
        ? 'https://places.googleapis.com/v1/places:autocomplete'
        : `https://places.googleapis.com/v1/places/${encodeURIComponent(input)}`,
    );
    if (operation === 'details') {
      url.searchParams.set('sessionToken', sessionToken);
      url.searchParams.set('languageCode', 'uk');
      url.searchParams.set('regionCode', 'ua');
    }
    const controller = new AbortController();
    const timeoutMs = Number(
      this.config.get('ADDRESS_LOOKUP_TIMEOUT_MS', 5000),
    );
    const timeout = setTimeout(
      () => controller.abort(),
      Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5000,
    );
    const start = Date.now();
    let status = 'network-error';
    try {
      const response = await fetch(url, {
        method: operation === 'autocomplete' ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            operation === 'autocomplete'
              ? 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.types'
              : 'id,addressComponents,formattedAddress,attributions',
        },
        ...(operation === 'autocomplete'
          ? {
              body: JSON.stringify({
                input,
                sessionToken,
                includedRegionCodes: ['ua'],
                languageCode: 'uk',
                regionCode: 'ua',
                includeQueryPredictions: false,
              }),
            }
          : {}),
        signal: controller.signal,
      });
      status = String(response.status);
      if (response.status === 400) {
        const errorBody: unknown = await response.json().catch(() => null);
        const googleError =
          isObject(errorBody) && isObject(errorBody.error)
            ? errorBody.error
            : null;
        const message = text(googleError?.message);
        if (message?.toLowerCase().includes('api key not valid')) {
          status = 'invalid-api-key';
          throw new ServiceUnavailableException(
            'Address lookup is unavailable',
          );
        }
        throw new BadGatewayException(
          'Google Places rejected the address lookup request',
        );
      }
      if (response.status === 404)
        throw new NotFoundException('Address suggestion was not found');
      if (response.status === 429)
        throw new HttpException(
          'Address lookup quota exceeded',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      if (response.status === 401 || response.status === 403)
        throw new ServiceUnavailableException('Address lookup is unavailable');
      if (!response.ok)
        throw new BadGatewayException('Address lookup service is unavailable');
      return await response.json();
    } catch (error) {
      if (controller.signal.aborted) {
        status = 'timeout';
        throw new GatewayTimeoutException('Address lookup timed out');
      }
      if (error instanceof HttpException) throw error;
      throw new BadGatewayException('Address lookup service is unavailable');
    } finally {
      clearTimeout(timeout);
      this.logger.log({
        provider: 'google-places',
        operation,
        status,
        durationMs: Date.now() - start,
      });
    }
  }
}
