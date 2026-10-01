import { IsIn, IsString, IsOptional } from 'class-validator';

export class CreateBusinessDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description: string;

  @IsString()
  @IsIn(['GBP', 'EUR', 'UAH'])
  @IsOptional()
  currency?: string;
}
