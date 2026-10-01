import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTariffGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  originCountryId: number;

  @IsInt()
  destinationCountryId: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
