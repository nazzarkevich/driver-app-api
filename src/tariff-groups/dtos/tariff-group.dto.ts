import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class TariffGroupDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  businessId: number;

  @Expose()
  originCountryId: number;

  @Expose()
  originCountry: { id: number; name: string; isoCode: string };

  @Expose()
  destinationCountryId: number;

  @Expose()
  destinationCountry: { id: number; name: string; isoCode: string };

  @Expose()
  isActive: boolean;

  @Expose()
  tariffsCount: number;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<TariffGroupDto> & { _count?: { tariffs: number } }) {
    Object.assign(this, partial);
    this.tariffsCount = partial._count?.tariffs ?? partial.tariffsCount ?? 0;
  }
}
