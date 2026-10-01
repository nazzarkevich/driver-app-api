import { IsOptional, IsString, IsBoolean, IsDate, IsIn } from 'class-validator';

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDate()
  activationDate?: Date;

  @IsOptional()
  @IsString()
  @IsIn(['GBP', 'EUR', 'UAH'])
  currency?: string;
}
