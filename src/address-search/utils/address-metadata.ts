import { BadRequestException } from '@nestjs/common';

interface AddressMetadata {
  provider?: string | null;
  providerRef?: string | null;
  uprn?: string | null;
  latitude?: unknown;
  longitude?: unknown;
}

export function validateAddressMetadata(
  country: string,
  address: AddressMetadata,
): void {
  if (!['GB', 'UA'].includes(country))
    throw new BadRequestException('Unsupported address country');
  if (
    address.provider &&
    address.provider !==
      (country === 'GB' ? 'ideal-postcodes' : 'google-places')
  ) {
    throw new BadRequestException('Address provider does not match country');
  }
  if (
    country === 'UA' &&
    (address.uprn ||
      (address.provider === 'google-places' &&
        (address.latitude != null || address.longitude != null)))
  ) {
    throw new BadRequestException(
      'UPRN and coordinates are not supported for Ukrainian addresses',
    );
  }
  if (!!address.provider !== !!address.providerRef)
    throw new BadRequestException(
      'Address provider and reference must be supplied together',
    );
}

export function validateUkraineAddress(address: {
  countryIsoCode: string;
  street?: string | null;
  line1?: string | null;
  city?: string | null;
  village?: string | null;
  postcode?: string | null;
}): void {
  if (address.countryIsoCode !== 'UA') return;
  if (
    !(address.street?.trim() || address.line1?.trim()) ||
    !(address.city?.trim() || address.village?.trim())
  ) {
    throw new BadRequestException(
      'Ukrainian addresses require a street and a city or village',
    );
  }
  if (
    address.postcode != null &&
    address.postcode !== '' &&
    !/^\d{5}$/.test(address.postcode)
  ) {
    throw new BadRequestException(
      'Ukrainian postcode must contain five digits',
    );
  }
}
