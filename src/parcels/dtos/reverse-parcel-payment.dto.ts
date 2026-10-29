import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CashCollectionDto } from './cash-collection.dto';

export class ReverseParcelPaymentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason: string;

  @IsISO8601()
  expectedUpdatedAt: string;

  @ValidateNested()
  @Type(() => CashCollectionDto)
  @IsOptional()
  replacement?: CashCollectionDto;
}
