import { ParcelPaymentMethod, PaymentParty } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export enum CashCollectionType {
  Full = 'Full',
  Partial = 'Partial',
}

export class CashCollectionDto {
  @IsEnum(CashCollectionType)
  type: CashCollectionType;

  @IsEnum(PaymentParty)
  payerParty: PaymentParty;

  @IsEnum(ParcelPaymentMethod)
  @IsOptional()
  method?: ParcelPaymentMethod;

  @ValidateIf((value) => value.type === CashCollectionType.Partial)
  @IsString()
  @Matches(/^\d+(?:\.\d{1,2})?$/, {
    message: 'amount must be a positive decimal string with at most 2 decimals',
  })
  amount?: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  note?: string;
}
