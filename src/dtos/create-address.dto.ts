import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAddressDto {
  @IsOptional()
  @IsString()
  flat?: string;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  village?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsString({ message: 'Country should be a string' })
  @IsNotEmpty({ message: "Country can't be empty" })
  countryIsoCode: string;

  @IsOptional()
  @IsString()
  postcode?: string;
}
