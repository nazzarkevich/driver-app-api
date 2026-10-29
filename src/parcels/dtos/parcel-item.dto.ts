import { DeliveryStatus, ParcelType, PaymentParty } from '@prisma/client';
import {
  IsOptional,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsNotEmpty,
  IsInt,
  Min,
  IsEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CashCollectionDto } from './cash-collection.dto';

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

  @IsEmpty({ message: 'paymentStatus must be changed through payment actions' })
  paymentStatus?: never;

  @IsEnum(DeliveryStatus)
  @IsOptional()
  initialDeliveryStatus?: DeliveryStatus;

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

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  priceOverrideReason?: string;

  @ValidateNested()
  @Type(() => CashCollectionDto)
  @IsOptional()
  paymentCollection?: CashCollectionDto;

  /** @deprecated Use paymentCollection. */
  @ValidateNested()
  @Type(() => CashCollectionDto)
  @IsOptional()
  cashCollection?: CashCollectionDto;
}
