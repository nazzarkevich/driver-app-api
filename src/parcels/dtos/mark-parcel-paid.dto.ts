import { IsISO8601 } from 'class-validator';

export class MarkParcelPaidDto {
  @IsISO8601()
  expectedUpdatedAt: string;
}
