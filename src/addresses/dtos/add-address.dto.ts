import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

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

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @Transform((param) => param.value.toLowerCase().replace(/\s+/g, ''))
  postcode?: string;

  @IsString()
  @IsNotEmpty()
  street: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  countryIsoCode: string;

  @IsNumber()
  @IsNotEmpty()
  profileId: number;
}
