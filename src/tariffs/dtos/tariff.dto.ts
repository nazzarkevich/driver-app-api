import { ParcelType } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class TariffDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  description?: string;

  @Expose()
  minimumPrice: number;

  @Expose()
  pricePerKg?: number;

  @Expose()
  weightThreshold?: number;

  @Expose()
  currency: string;

  @Expose()
  isWeightBased: boolean;

  @Expose()
  parcelTypes: ParcelType[];

  @Expose()
  isActive: boolean;

  @Expose()
  businessId: number;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<TariffDto>) {
    Object.assign(this, partial);
  }
}
