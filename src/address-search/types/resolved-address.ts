export interface ResolvedAddress {
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
