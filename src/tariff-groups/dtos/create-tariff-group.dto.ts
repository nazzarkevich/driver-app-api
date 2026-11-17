import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
export class CreateTariffGroupDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  name: string;
  @IsInt()
  @Min(1)
  originCountryId: number;
  @IsInt()
  @Min(1)
  destinationCountryId: number;
  @ValidateIf((_dto, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}
