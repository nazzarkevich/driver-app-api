import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAddressDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  flat?: string;

  @IsString({ message: 'Street should be a string' })
  @IsNotEmpty({ message: "Street can't be empty" })
  street: string;

  @IsString({ message: 'Profile should be a string' })
  @IsNotEmpty({ message: "Profile can't be empty" })
  profileId: string;

  @IsString({ message: 'City should be a string' })
  @IsNotEmpty({ message: "City can't be empty" })
  city: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  region?: string;

  @IsString({ message: 'Country should be a string' })
  @IsNotEmpty({ message: "Country can't be empty" })
  countryIsoCode: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  postcode?: string;
}
