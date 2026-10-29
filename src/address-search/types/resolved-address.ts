export interface ResolvedUkAddress {
  line1: string;
  line2: string | null;
  line3: string | null;
  city: string;
  county: string | null;
  postcode: string;
  countryCode: 'GB';
  uprn: string | null;
  latitude: number | null;
  longitude: number | null;
  provider: string;
  providerRef: string | null;
}

export interface PostcodeValidationResult {
  postcode: string;
  valid: boolean;
  latitude: number | null;
  longitude: number | null;
  country?: string | null;
  region?: string | null;
  adminDistrict?: string | null;
  adminCounty?: string | null;
  externalServiceAvailable: boolean;
}

export interface ResolvedUkraineAddress {
  countryCode: 'UA';
  street: string | null;
  building: string | null;
  city: string | null;
  village: string | null;
  region: string | null;
  postcode: string | null;
  provider: 'google-places';
  providerRef: string;
  attributions: { displayName: string; uri: string }[];
}

export type ResolvedAddress = ResolvedUkAddress | ResolvedUkraineAddress;
