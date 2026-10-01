import { Exclude, Expose } from 'class-transformer';

@Expose()
export class AddressDto {
  id: number;
  street: string;
  city?: string;
  village?: string;
  state: string;
  postcode: string;
  apartment: string;
  country: string;
  line1?: string;
  line2?: string;
  line3?: string;
  county?: string;
  uprn?: string;
  latitude?: unknown;
  longitude?: unknown;
  provider?: string;
  providerRef?: string;

  @Exclude()
  profileId: number;

  constructor(partial: Partial<AddressDto>) {
    Object.assign(this, partial);
  }
}
