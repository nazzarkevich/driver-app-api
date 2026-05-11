import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsInt,
} from 'class-validator';
import { ParcelType } from '@prisma/client';

export class CreateTariffDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsEnum(ParcelType)
  @IsOptional()
  parcelType?: ParcelType | null;

  @IsInt()
  @IsOptional()
  originCountryId?: number | null;

  @IsNumber()
  @IsNotEmpty()
  minimumPrice: number;

  @IsNumber()
  @IsOptional()
  pricePerKg?: number;

  @IsNumber()
  @IsOptional()
  weightThreshold?: number;

  @IsBoolean()
  @IsOptional()
  isWeightBased?: boolean;
}
