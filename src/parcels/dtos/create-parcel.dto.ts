import { DiscountType, ParcelType, PaymentStatus } from '@prisma/client';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDate,
  IsNotEmpty,
} from 'class-validator';

// TODO: extend parcel details with UA and UK addresses
// TODO: split tables for UA and UK addresses
export class CreateParcelDto {
  @IsNumber()
  weight: number;

  @IsNumber()
  price: number;

  @IsNumber()
  cost: number;

  @IsNumber()
  @IsOptional()
  parcelMoneyAmount: number;

  @IsNumber()
  @IsOptional()
  discount: number;

  @IsEnum(DiscountType)
  @IsOptional()
  discountType: DiscountType;

  @IsEnum(ParcelType)
  cargoType: ParcelType;

  @IsEnum(PaymentStatus)
  @IsNotEmpty()
  paymentStatus: PaymentStatus;

  @IsDate()
  @IsNotEmpty()
  pickupDate: Date;

  @IsNumber()
  @IsNotEmpty()
  senderId: number;

  @IsNumber()
  @IsNotEmpty()
  recipientId: number;

  @IsString()
  @IsNotEmpty()
  recipientPhoneNumber: string;

  @IsString()
  @IsNotEmpty()
  senderPhoneNumber: string;

  @IsNumber()
  @IsOptional()
  journeyId: number;

  @IsString()
  @IsOptional()
  notes: string;

  @IsNumber()
  @IsNotEmpty()
  originAddressId: number;

  @IsNumber()
  @IsNotEmpty()
  destinationAddressId: number;
}
