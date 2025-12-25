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
  country: CountryDto;

  constructor(partial: Partial<AddressWithCountryDto>) {
    Object.assign(this, partial);
    if (partial?.country) {
      this.country = new CountryDto(partial.country);
    }
  }
}
