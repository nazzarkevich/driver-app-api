import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class UpdateAddressDto {
  @IsString() @IsOptional() street?: string;
  @IsString() @IsOptional() city?: string;
  @IsString() @IsOptional() village?: string;
  @IsString() @IsOptional() region?: string;
  @IsString() @IsOptional() postcode?: string;
  @IsString() @IsOptional() building?: string;
  @IsString() @IsOptional() flat?: string;
  @IsString() @IsOptional() @IsNotEmpty() countryIsoCode?: string;
}
