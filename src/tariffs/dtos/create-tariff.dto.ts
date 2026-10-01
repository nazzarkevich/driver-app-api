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
  ValidateIf,
} from 'class-validator';
import { ParcelType } from '@prisma/client';

export class CreateTariffDto {
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
  @IsNotEmpty()
  tariffGroupId: number;

  @IsEnum(ParcelType)
  @IsOptional()
  parcelType?: ParcelType | null;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  minimumPrice: number;

  @ValidateIf((dto) => dto.pricingType === 'PerKg')
  @IsNumber()
  @Min(0.01)
  pricePerKg?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  weightThreshold?: number;

  @IsIn(['Fixed', 'PerKg'])
  @IsOptional()
  pricingType?: 'Fixed' | 'PerKg';
}
