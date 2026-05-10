import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsBoolean,
  IsInt,
  IsNumber,
} from 'class-validator';

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

  @IsInt()
  @IsOptional()
  parcelTypeId?: number | null;

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
