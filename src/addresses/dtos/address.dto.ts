import { Exclude, Expose } from 'class-transformer';

@Expose()
export class AddressDto {
  id: number;
  street: string;
  city: string;
  state: string;
  postcode: string;
  apartment: string;
  country: string;

  @Exclude()
  profileId: number;

  constructor(partial: Partial<AddressDto>) {
    Object.assign(this, partial);
  }
}
