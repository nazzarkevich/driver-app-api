import { IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';
import { IsCityOrVillage } from 'src/validators/is-city-or-village.validator';

export class CreateAddressDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  flat?: string;

  @IsString({ message: 'Street should be a string' })
  @IsNotEmpty({ message: "Street can't be empty" })
  street: string;

  @IsCityOrVillage()
  @IsString({ message: 'City should be a string' })
  @IsNotEmpty({ message: "City can't be empty" })
  city?: string;

  @IsString({ message: 'Village should be a string' })
  @IsNotEmpty({ message: "Village can't be empty" })
  village?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  region?: string;

  @IsString({ message: 'Country should be a string' })
  @IsNotEmpty({ message: "Country can't be empty" })
  countryIsoCode: string;

  @ValidateIf((o) => o.countryIsoCode !== 'GB')
  @IsOptional()
  @ValidateIf((o) => o.countryIsoCode === 'GB')
  @IsString()
  @IsNotEmpty({ message: 'Postcode is required for Great Britain addresses' })
  postcode?: string;
}
