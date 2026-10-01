import { Expose } from 'class-transformer';
import { CountryDto } from '../../countries/dtos/country.dto';

@Expose()
export class AddressWithCountryDto {
  id: number;
  street: string;
  city: string | null;
  village: string | null;
  postcode: string | null;
  block: string | null;
  building: string | null;
  flat: string | null;
  note: string | null;
  region: string | null;
  line1: string | null;
  line2: string | null;
  line3: string | null;
  county: string | null;
  uprn: string | null;
  latitude: unknown | null;
  longitude: unknown | null;
  provider: string | null;
  providerRef: string | null;
  isPrimary: boolean;
  isActive: boolean;
  country: CountryDto;

  constructor(partial: Partial<AddressWithCountryDto>) {
    Object.assign(this, partial);
    if (partial?.country) {
      this.country = new CountryDto(partial.country);
    }
  }
}
