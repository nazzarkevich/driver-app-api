import { ParcelType, PaymentParty } from '@prisma/client';
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
  IsEmpty,
  IsDateString,
} from 'class-validator';

export class UpdateParcelDto {
  @IsDateString()
  expectedUpdatedAt: string;

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

  @IsEmpty({ message: 'paymentStatus must be changed through payment actions' })
  paymentStatus?: never;

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

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  priceOverrideReason?: string;
}
