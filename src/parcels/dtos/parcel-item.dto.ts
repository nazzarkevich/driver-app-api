import { ParcelType, PaymentParty, PaymentStatus } from '@prisma/client';
import {
  IsOptional,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';

export class ParcelItemDto {
  @IsNumber()
  @IsNotEmpty()
  weight: number;

  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsNumber()
  @IsNotEmpty()
  cost: number;

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
  @IsNotEmpty()
  paymentStatus: PaymentStatus;

  @IsEnum(PaymentParty)
  @IsNotEmpty()
  paidBy: PaymentParty;
}
