import { Exclude, Expose } from 'class-transformer';
import { ParcelType } from '@prisma/client';

@Exclude()
export class TariffDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  description?: string;

  @Expose()
  currency: string;

  @Expose()
  isActive: boolean;

  @Expose()
  businessId: number;

  @Expose()
  parcelType: ParcelType | null;

  @Expose()
  originCountryId: number | null;

  @Expose()
  originCountry: { id: number; name: string } | null;

  @Expose()
  minimumPrice: number;

  @Expose()
  pricePerKg: number | null;

  @Expose()
  weightThreshold: number | null;

  @Expose()
  isWeightBased: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<TariffDto>) {
    Object.assign(this, partial);
  }
}
