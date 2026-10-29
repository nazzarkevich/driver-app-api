import { Type } from 'class-transformer';
import { IsISO8601, ValidateNested } from 'class-validator';
import { CashCollectionDto } from './cash-collection.dto';

export class CollectParcelPaymentDto {
  @ValidateNested()
  @Type(() => CashCollectionDto)
  collection: CashCollectionDto;

  @IsISO8601()
  expectedUpdatedAt: string;
}
