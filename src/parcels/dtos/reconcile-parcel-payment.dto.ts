import {
  IsISO8601,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ReconcileParcelPaymentDto {
  @IsString()
  @Matches(/^\d+(?:\.\d{1,2})?$/, {
    message:
      'amount must be a non-negative decimal string with at most 2 decimals',
  })
  amount: string;

  @IsString()
  @IsIn(['GBP', 'EUR', 'UAH'])
  currency: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason: string;

  @IsISO8601()
  expectedUpdatedAt: string;
}
