import { DiscountType, ParcelType, PaymentStatus } from '@prisma/client';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDate,
  IsNotEmpty,
} from 'class-validator';

export class CreateParcelDto {
  @IsNumber()
  weight: number;

  @IsNumber()
  price: number;

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
  type: ParcelType;

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

  @IsNumber()
  @IsOptional()
  journeyId: number;

  @IsString()
  @IsOptional()
  notes: string;
}
