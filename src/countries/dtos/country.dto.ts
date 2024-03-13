import { Exclude, Expose } from 'class-transformer';

@Expose()
export class CountryDto {
  id: number;
  name: string;
  isoCode: string;

  @Exclude()
  createdAt: Date;

  @Exclude()
  updatedAt: Date;

  constructor(partial: Partial<CountryDto>) {
    Object.assign(this, partial);
  }
}
