import {
  DiscountType,
  ParcelType,
  PaymentParty,
  PaymentStatus,
} from '@prisma/client';
import {
  IsEnum,
  IsString,
  IsOptional,
  IsNumber,
  IsDate,
} from 'class-validator';

export class UpdateParcelDto {
  @IsNumber()
  @IsOptional()
  weight: number;

  @IsNumber()
  @IsOptional()
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
  @IsOptional()
  type: ParcelType;

  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus: PaymentStatus;

  @IsEnum(PaymentParty)
  @IsOptional()
  paidBy: PaymentParty;

  @IsDate()
  @IsOptional()
  pickupDate: Date;

  @IsNumber()
  @IsOptional()
  senderId: number;

  @IsNumber()
  @IsOptional()
  recipientId: number;

  @IsNumber()
  @IsOptional()
  journeyId: number;

  @IsString()
  @IsOptional()
  notes: string;
}
