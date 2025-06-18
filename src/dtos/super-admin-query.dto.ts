import { IsOptional, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';

export class SuperAdminQueryDto {
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value))
  businessId?: number; // SuperAdmin can specify businessId for cross-business operations
}
