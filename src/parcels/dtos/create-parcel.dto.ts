import { DeliveryStatus, ParcelType, PaymentParty } from '@prisma/client';
import {
  IsOptional,
  IsNumber,
  IsEnum,
  IsNotEmpty,
  ValidateNested,
  IsInt,
  Min,
  IsEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ParcelDestinationDto } from './parcel-destination.dto';
import { CashCollectionDto } from './cash-collection.dto';

export class CreateParcelDto {
  @IsNumber()
  @Min(0.001)
  weight: number;

  @IsNumber()
  @IsOptional()
  parcelMoneyAmount: number;

  @IsEnum(ParcelType)
  @IsNotEmpty()
  parcelType: ParcelType;

  @IsEmpty({ message: 'paymentStatus must be changed through payment actions' })
  paymentStatus?: never;

  @IsEnum(DeliveryStatus)
  @IsOptional()
  initialDeliveryStatus?: DeliveryStatus;

  @IsEnum(PaymentParty)
  @IsOptional()
  paidBy?: PaymentParty;

  @IsNumber()
  @IsNotEmpty()
  senderId: number;

  @IsNumber()
  @IsNotEmpty()
  recipientId: number;

  @IsNumber()
  @IsOptional()
  journeyId: number;

  @ValidateNested()
  @Type(() => ParcelDestinationDto)
  @IsNotEmpty()
  origin: ParcelDestinationDto;

  @ValidateNested()
  @Type(() => ParcelDestinationDto)
  @IsNotEmpty()
  destination: ParcelDestinationDto;

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
