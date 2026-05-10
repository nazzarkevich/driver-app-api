import {
  DiscountType,
  PaymentParty,
  PaymentStatus,
} from '@prisma/client';
import {
  IsEnum,
  IsString,
  IsOptional,
  IsNumber,
  IsDate,
  IsInt,
  IsDateString,
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

  @IsNumber()
  @IsOptional()
  parcelTypeId?: number;

  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus: PaymentStatus;

  @IsEnum(PaymentParty)
  @IsOptional()
  paidBy: PaymentParty;

  @IsInt()
  @IsOptional()
  pickedUpByCourierId?: number;

  @IsInt()
  @IsOptional()
  pickedUpByDriverId?: number;

  @IsOptional()
  @IsDateString()
  pickedUpAt?: Date;

  @IsInt()
  @IsOptional()
  deliveredByCourierId?: number;

  @IsInt()
  @IsOptional()
  deliveredByDriverId?: number;

  @IsOptional()
  @IsDateString()
  deliveredAt?: Date;

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
}
