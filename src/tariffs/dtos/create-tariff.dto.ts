import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsInt,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ParcelType } from '@prisma/client';

export class CreateTariffDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @Min(1)
  @IsNotEmpty()
  tariffGroupId: number;

  @IsEnum(ParcelType)
  @IsOptional()
  parcelType?: ParcelType | null;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  @IsNotEmpty()
  minimumPrice: number;

  @ValidateIf((dto) => dto.pricingType === 'PerKg')
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  pricePerKg?: number;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(9999999.999)
  @IsOptional()
  weightThreshold?: number;

  @IsIn(['Fixed', 'PerKg'])
  @IsOptional()
  pricingType?: 'Fixed' | 'PerKg';
}
