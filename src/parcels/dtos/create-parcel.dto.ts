import {
  Business,
  CustomerProfile,
  DiscountType,
  Journey,
  ParcelType,
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

  @IsNotEmpty()
  sender: CustomerProfile;

  @IsNotEmpty()
  recipient: CustomerProfile;

  @IsNotEmpty()
  business: Business;

  @IsNotEmpty()
  journey: Journey;

  @IsString()
  @IsOptional()
  notes: string;
}
