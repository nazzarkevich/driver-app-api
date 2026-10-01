import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ADDRESS_PROVIDER,
  AddressProvider,
  POSTCODE_PROVIDER,
  PostcodeProvider,
} from './providers/address-provider.interface';
import { AddressSearchCache } from './address-search.cache';
import { AddressSearchResponse } from './types/address-suggestion';
import {
  PostcodeValidationResult,
  ResolvedAddress,
} from './types/resolved-address';
import { isValidUkPostcode, normalizeUkPostcode } from './utils/uk-postcode';

@Injectable()
export class AddressSearchService {
  private readonly postcodeLookupEnabled: boolean;

  constructor(
    @Inject(ADDRESS_PROVIDER) private readonly provider: AddressProvider,
    @Inject(POSTCODE_PROVIDER) private readonly postcodeProvider: PostcodeProvider,
    private readonly cache: AddressSearchCache,
    configService: ConfigService,
  ) {
    this.postcodeLookupEnabled =
      configService.get<string>('POSTCODES_IO_ENABLED', 'true').toLowerCase() !==
      'false';
  }

  async search(query: string): Promise<AddressSearchResponse> {
    const normalizedQuery = query.trim().replace(/\s+/g, ' ');
    const key = `search:${normalizedQuery.toLocaleLowerCase('en-GB')}`;
    const cached = this.cache.get<AddressSearchResponse>(key);
    if (cached) return cached;
    const response = { results: (await this.provider.search(normalizedQuery)).slice(0, 10) };
    this.cache.set(key, response, 5 * 60_000);
    return response;
  }

  async retrieve(id: string): Promise<ResolvedAddress> {
    const key = `retrieve:${id}`;
    const cached = this.cache.get<ResolvedAddress>(key);
    if (cached) return cached;
    const address = await this.provider.retrieve(id);
    this.cache.set(key, address, 60 * 60_000);
    return address;
  }

  async validatePostcode(postcode: string): Promise<PostcodeValidationResult> {
    const normalized = normalizeUkPostcode(postcode);
    const locallyValid = isValidUkPostcode(normalized);
    if (!locallyValid || !this.postcodeLookupEnabled) {
      return {
        postcode: normalized,
        valid: locallyValid,
        latitude: null,
        longitude: null,
        externalServiceAvailable: false,
      };
    }
    const key = `postcode:${normalized.replace(/\s/g, '')}`;
    const cached = this.cache.get<PostcodeValidationResult>(key);
    if (cached) return cached;
    try {
      const result = await this.postcodeProvider.lookup(normalized);
      const response =
        result ?? {
          postcode: normalized,
          valid: false,
          latitude: null,
          longitude: null,
          externalServiceAvailable: true,
        };
      this.cache.set(key, response, 24 * 60 * 60_000);
      return response;
    } catch {
      return {
        postcode: normalized,
        valid: true,
        latitude: null,
        longitude: null,
        externalServiceAvailable: false,
      };
    }
  }
}
