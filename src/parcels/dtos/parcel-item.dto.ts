import {
  DiscountType,
  ParcelType,
  PaymentParty,
  PaymentStatus,
} from '@prisma/client';
import {
  IsString,
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
  cargoType: ParcelType;

  @IsNumber()
  @IsOptional()
  tariffId?: number;

  @IsNumber()
  @IsOptional()
  parcelMoneyAmount?: number;

  @IsNumber()
  @IsOptional()
  discount?: number;

  @IsEnum(DiscountType)
  @IsOptional()
  discountType?: DiscountType;

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
