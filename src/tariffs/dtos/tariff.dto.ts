import { Exclude, Expose } from 'class-transformer';
import { ParcelType, TariffPricingType } from '@prisma/client';

const toNumber = (val: any): number | null => {
  if (val == null) return null;
  const n = parseFloat(String(val));
  return isNaN(n) ? null : n;
};

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
  tariffGroupId: number | null;

  @Expose()
  tariffGroup: {
    id: number;
    name: string;
    isActive: boolean;
    originCountryId: number;
    destinationCountryId: number;
    originCountry: { id: number; name: string; isoCode: string };
    destinationCountry: { id: number; name: string; isoCode: string };
  } | null;

  @Expose()
  parcelType: ParcelType | null;

  @Expose()
  minimumPrice: number;

  @Expose()
  pricePerKg: number | null;

  @Expose()
  weightThreshold: number | null;

  @Expose()
  pricingType: TariffPricingType;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<TariffDto>) {
    Object.assign(this, partial);
    this.minimumPrice = toNumber(partial.minimumPrice) ?? 0;
    this.pricePerKg = toNumber(partial.pricePerKg);
    this.weightThreshold = toNumber(partial.weightThreshold);
  }
}
