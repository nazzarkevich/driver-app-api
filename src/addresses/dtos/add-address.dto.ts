import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { IsCityOrVillage } from 'src/validators/is-city-or-village.validator';

export class AddAddressDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  flat?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  building?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  block?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  region?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  note?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  state?: string;

  @ValidateIf((o) => o.countryIsoCode === 'GB')
  @IsString()
  @IsNotEmpty({ message: 'Postcode is required for Great Britain addresses' })
  @Transform((param) => param.value?.toLowerCase().replace(/\s+/g, ''))
  postcode?: string;

  @IsString()
  @IsNotEmpty()
  street: string;

  @IsCityOrVillage()
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  city?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  village?: string;

  @IsString()
  @IsNotEmpty()
  countryIsoCode: string;

  @IsNumber()
  @IsOptional()
  profileId?: number;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}
