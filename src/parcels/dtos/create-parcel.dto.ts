import { ParcelType, PaymentParty, PaymentStatus } from '@prisma/client';
import {
  IsOptional,
  IsNumber,
  IsEnum,
  IsNotEmpty,
  ValidateNested,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ParcelDestinationDto } from './parcel-destination.dto';

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

  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus?: PaymentStatus;

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
}
