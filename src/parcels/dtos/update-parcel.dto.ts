import { ParcelType, PaymentParty, PaymentStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateParcelDto {
  @IsNumber()
  @Min(0.001)
  @IsOptional()
  weight?: number;

  @IsEnum(ParcelType)
  @IsOptional()
  parcelType?: ParcelType;

  @IsInt()
  @IsOptional()
  tariffId?: number;

  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @Min(0)
  @IsOptional()
  priceOverride?: number | null;

  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @Min(0)
  @IsOptional()
  parcelMoneyAmount?: number | null;

  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus?: PaymentStatus;

  @IsEnum(PaymentParty)
  @IsOptional()
  paidBy?: PaymentParty;

  @IsBoolean()
  @IsOptional()
  hasBorderCheck?: boolean;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  note?: string;
}
