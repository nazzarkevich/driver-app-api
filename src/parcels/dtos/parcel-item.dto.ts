import { ParcelType, PaymentParty, PaymentStatus } from '@prisma/client';
import {
  IsOptional,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsNotEmpty,
  IsInt,
  Min,
} from 'class-validator';

export class ParcelItemDto {
  @IsNumber()
  @Min(0.001)
  @IsNotEmpty()
  weight: number;

  @IsEnum(ParcelType)
  @IsNotEmpty()
  parcelType: ParcelType;

  @IsNumber()
  @IsOptional()
  parcelMoneyAmount?: number;

  @IsBoolean()
  @IsOptional()
  hasBorderCheck?: boolean;

  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus?: PaymentStatus;

  @IsEnum(PaymentParty)
  @IsOptional()
  paidBy?: PaymentParty;

  @IsInt()
  @IsNotEmpty()
  tariffId: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  priceOverride?: number;
}
