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
  IsDate,
  IsNotEmpty,
} from 'class-validator';

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
  @IsNotEmpty()
  parcelType: ParcelType;

  @IsEnum(PaymentStatus)
  @IsNotEmpty()
  paymentStatus: PaymentStatus;

  @IsEnum(PaymentParty)
  @IsNotEmpty()
  paidBy: PaymentParty;

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

  @IsNumber()
  @IsNotEmpty()
  originAddressId: number;

  @IsNumber()
  @IsNotEmpty()
  destinationAddressId: number;

  @IsNumber()
  @IsOptional()
  tariffId?: number;
}
