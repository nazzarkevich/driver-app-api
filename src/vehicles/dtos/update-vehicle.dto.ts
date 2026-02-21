import { IsString, IsOptional, MinLength, IsDate, IsBoolean } from 'class-validator';

export class UpdateVehicleDto {
  @IsString()
  @IsOptional()
  @MinLength(4)
  plateNumber?: string;

  @IsString()
  @IsOptional()
  @MinLength(2)
  model?: string;

  @IsString()
  @IsOptional()
  @MinLength(2)
  make?: string;

  @IsDate()
  @IsOptional()
  year?: Date;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
