import { ParcelType } from '@prisma/client';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsNotEmpty,
  IsBoolean,
  IsEnum,
  IsArray,
  Min,
  ValidateIf,
  ArrayMinSize,
} from 'class-validator';

export class CreateTariffDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  minimumPrice: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @ValidateIf((o) => o.isWeightBased === true)
  pricePerKg?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @ValidateIf((o) => o.isWeightBased === true)
  weightThreshold?: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsBoolean()
  @IsNotEmpty()
  isWeightBased: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(ParcelType, { each: true })
  parcelTypes: ParcelType[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
