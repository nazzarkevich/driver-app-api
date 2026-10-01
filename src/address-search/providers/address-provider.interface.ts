import { AddressSuggestion } from '../types/address-suggestion';
import {
  PostcodeValidationResult,
  ResolvedAddress,
} from '../types/resolved-address';

export const ADDRESS_PROVIDER = Symbol('ADDRESS_PROVIDER');
export const POSTCODE_PROVIDER = Symbol('POSTCODE_PROVIDER');

export interface AddressProvider {
  search(query: string): Promise<AddressSuggestion[]>;
  retrieve(id: string): Promise<ResolvedAddress>;
}

export interface PostcodeProvider {
  lookup(postcode: string): Promise<PostcodeValidationResult | null>;
}
