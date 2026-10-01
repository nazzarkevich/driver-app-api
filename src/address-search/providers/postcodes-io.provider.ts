import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostcodeProvider } from './address-provider.interface';
import { PostcodeValidationResult } from '../types/resolved-address';
import { normalizeUkPostcode } from '../utils/uk-postcode';

interface PostcodesIoResult {
  postcode: string;
  latitude: number | null;
  longitude: number | null;
  country: string | null;
  region: string | null;
  admin_district: string | null;
  admin_county: string | null;
}

@Injectable()
export class PostcodesIoProvider implements PostcodeProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService
      .get<string>('POSTCODES_IO_BASE_URL', 'https://api.postcodes.io')
      .replace(/\/$/, '');
    this.timeoutMs = this.configService.get<number>(
      'ADDRESS_LOOKUP_TIMEOUT_MS',
      5000,
    );
  }

  async lookup(postcode: string): Promise<PostcodeValidationResult | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(
        `${this.baseUrl}/postcodes/${encodeURIComponent(postcode)}`,
        { headers: { Accept: 'application/json' }, signal: controller.signal },
      );
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Postcodes.io request failed');
      const payload = await response.json();
      const result = (payload as any)?.result;
      if ((payload as any)?.status !== 200 || !this.isResult(result)) {
        throw new Error('Invalid Postcodes.io response');
      }
      return {
        postcode: normalizeUkPostcode(result.postcode),
        valid: true,
        latitude: this.coordinate(result.latitude, -90, 90),
        longitude: this.coordinate(result.longitude, -180, 180),
        country: result.country,
        region: result.region,
        adminDistrict: result.admin_district,
        adminCounty: result.admin_county,
        externalServiceAvailable: true,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private isResult(value: unknown): value is PostcodesIoResult {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as PostcodesIoResult).postcode === 'string'
    );
  }

  private coordinate(value: unknown, min: number, max: number): number | null {
    return typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= min &&
      value <= max
      ? value
      : null;
  }
}
