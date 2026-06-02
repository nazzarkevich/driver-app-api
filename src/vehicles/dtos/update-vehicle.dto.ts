import {
  IsString,
  IsOptional,
  MinLength,
  IsInt,
  IsBoolean,
} from 'class-validator';

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

  @IsInt()
  @IsOptional()
  year?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
