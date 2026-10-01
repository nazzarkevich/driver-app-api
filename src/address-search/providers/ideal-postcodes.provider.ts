import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AddressProvider } from './address-provider.interface';
import { AddressSuggestion } from '../types/address-suggestion';
import { ResolvedAddress } from '../types/resolved-address';
import { normalizeUkPostcode } from '../utils/uk-postcode';

interface IdealSuggestion {
  id: string;
  suggestion: string;
}

interface IdealResolvedAddress {
  line_1: string;
  line_2?: string;
  line_3?: string;
  post_town: string;
  county?: string;
  postcode: string;
  country_iso_2: string;
  uprn?: string;
  latitude?: number;
  longitude?: number;
}

@Injectable()
export class IdealPostcodesProvider implements AddressProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('IDEAL_POSTCODES_API_KEY', '');
    this.baseUrl = this.configService
      .get<string>(
        'IDEAL_POSTCODES_BASE_URL',
        'https://api.ideal-postcodes.co.uk/v1',
      )
      .replace(/\/$/, '');
    this.timeoutMs = this.configService.get<number>(
      'ADDRESS_LOOKUP_TIMEOUT_MS',
      5000,
    );
  }

  async search(query: string): Promise<AddressSuggestion[]> {
    const url = new URL(`${this.baseUrl}/autocomplete/addresses`);
    url.searchParams.set('query', query);
    url.searchParams.set('context', 'gbr');
    url.searchParams.set('limit', '10');
    const payload = await this.request(url);
    const hits = (payload as any)?.result?.hits;
    if (!Array.isArray(hits) || !hits.every(this.isSuggestion)) {
      throw new BadGatewayException('Address provider returned an invalid response');
    }
    return hits.slice(0, 10).map((hit: IdealSuggestion) => ({
      id: hit.id,
      label: hit.suggestion,
    }));
  }

  async retrieve(id: string): Promise<ResolvedAddress> {
    const url = new URL(
      `${this.baseUrl}/autocomplete/addresses/${encodeURIComponent(id)}/gbr`,
    );
    const payload = await this.request(url, true);
    const result = (payload as any)?.result;
    if (!this.isResolvedAddress(result)) {
      throw new BadGatewayException('Address provider returned an invalid response');
    }
    return {
      line1: result.line_1.trim(),
      line2: this.optionalString(result.line_2),
      line3: this.optionalString(result.line_3),
      city: result.post_town.trim(),
      county: this.optionalString(result.county),
      postcode: normalizeUkPostcode(result.postcode),
      countryCode: 'GB',
      uprn: this.optionalString(result.uprn),
      latitude: this.optionalCoordinate(result.latitude, -90, 90),
      longitude: this.optionalCoordinate(result.longitude, -180, 180),
      provider: 'ideal-postcodes',
      providerRef: id,
    };
  }

  private async request(url: URL, isRetrieve = false): Promise<unknown> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException('Address lookup is not configured');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: `api_key="${this.apiKey}"`,
        },
        signal: controller.signal,
      });
      if (response.status === 404 && isRetrieve) {
        throw new NotFoundException('Address suggestion was not found');
      }
      if (!response.ok) {
        throw new BadGatewayException('Address lookup service is unavailable');
      }
      const payload = await response.json();
      if ((payload as any)?.code !== 2000) {
        throw new BadGatewayException('Address lookup service returned an error');
      }
      return payload;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadGatewayException) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GatewayTimeoutException('Address lookup timed out');
      }
      throw new BadGatewayException('Address lookup service is unavailable');
    } finally {
      clearTimeout(timeout);
    }
  }

  private isSuggestion(value: unknown): value is IdealSuggestion {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as IdealSuggestion).id === 'string' &&
      typeof (value as IdealSuggestion).suggestion === 'string'
    );
  }

  private isResolvedAddress(value: unknown): value is IdealResolvedAddress {
    if (typeof value !== 'object' || value === null) return false;
    const address = value as IdealResolvedAddress;
    return (
      typeof address.line_1 === 'string' &&
      address.line_1.trim().length > 0 &&
      typeof address.post_town === 'string' &&
      address.post_town.trim().length > 0 &&
      typeof address.postcode === 'string' &&
      address.country_iso_2 === 'GB'
    );
  }

  private optionalString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private optionalCoordinate(
    value: unknown,
    minimum: number,
    maximum: number,
  ): number | null {
    return typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= minimum &&
      value <= maximum
      ? value
      : null;
  }
}
