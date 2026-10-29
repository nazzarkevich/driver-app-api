import { ParcelType, TariffPricingType } from '@prisma/client';
import { IsEnum, IsInt, IsNumber, Min } from 'class-validator';

export class ParcelPriceOptionsDto {
  @IsInt()
  originCountryId: number;

  @IsInt()
  destinationCountryId: number;

  @IsEnum(ParcelType)
  parcelType: ParcelType;

  @IsNumber()
  @Min(0.001)
  weight: number;
}

export class ParcelPriceOptionDto {
  pricePerKg: number | null;
  minimumPrice: number;
  tariffId: number;
  tariffName: string;
  tariffGroupId: number;
  tariffGroupName: string;
  pricingType: TariffPricingType;
  calculatedPrice: number;
}

export class ParcelPriceOptionsResponseDto {
  currency: string;
  options: ParcelPriceOptionDto[];
}
