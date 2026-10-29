import { AddressSuggestion } from '../types/address-suggestion';
import {
  PostcodeValidationResult,
  ResolvedAddress,
} from '../types/resolved-address';

export const ADDRESS_PROVIDER = Symbol('ADDRESS_PROVIDER');
export const POSTCODE_PROVIDER = Symbol('POSTCODE_PROVIDER');

export interface AddressLookupContext {
  countryCode?: 'GB' | 'UA';
  sessionToken?: string;
}

export interface AddressProvider {
  search(query: string, context?: AddressLookupContext): Promise<AddressSuggestion[]>;
  retrieve(id: string, context?: AddressLookupContext): Promise<ResolvedAddress>;
}

export interface PostcodeProvider {
  lookup(postcode: string): Promise<PostcodeValidationResult | null>;
}
