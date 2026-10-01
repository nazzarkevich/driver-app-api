import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsString,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';

export class UpdateAddressDto {
  @IsString() @IsOptional() street?: string;
  @IsString() @IsOptional() city?: string;
  @IsString() @IsOptional() village?: string;
  @IsString() @IsOptional() region?: string;
  @IsString() @IsOptional() postcode?: string;
  @IsString() @IsOptional() building?: string;
  @IsString() @IsOptional() flat?: string;
  @IsString() @IsOptional() block?: string;
  @IsString() @IsOptional() note?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsString() @IsOptional() line1?: string | null;
  @IsString() @IsOptional() line2?: string | null;
  @IsString() @IsOptional() line3?: string | null;
  @IsString() @IsOptional() county?: string | null;
  @IsString() @IsOptional() uprn?: string | null;
  @IsLatitude() @IsOptional() latitude?: number | null;
  @IsLongitude() @IsOptional() longitude?: number | null;
  @IsString() @IsOptional() provider?: string | null;
  @IsString() @IsOptional() providerRef?: string | null;
  @IsString() @IsOptional() @IsNotEmpty() countryIsoCode?: string;
}
