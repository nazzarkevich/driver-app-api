import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAddressDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  apartment?: string;

  @IsString({ message: 'Street should be a string' })
  @IsNotEmpty({ message: "Street can't be empty" })
  street: string;

  @IsString({ message: 'City should be a string' })
  @IsNotEmpty({ message: "City can't be empty" })
  city: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  state?: string;

  @IsString({ message: 'Country should be a string' })
  @IsNotEmpty({ message: "Country can't be empty" })
  country: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  postcode?: string;
}
