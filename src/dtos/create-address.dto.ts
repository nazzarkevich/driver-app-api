import { Transform } from 'class-transformer';
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  Matches,
  IsString,
  ValidateIf,
} from 'class-validator';
import {
  normalizeUkPostcode,
  UK_POSTCODE_PATTERN,
} from 'src/address-search/utils/uk-postcode';

export class CreateAddressDto {
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  flat?: string;

  @IsOptional()
  @IsString()
  street?: string;

  @ValidateIf((value) => !value.street)
  @IsString()
  @IsNotEmpty()
  line1?: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsOptional()
  @IsString()
  line3?: string;

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
  @IsIn(['GB', 'UA'])
  countryIsoCode: string;

  @ValidateIf((value) => value.countryIsoCode === 'GB')
  @IsString()
  @IsNotEmpty({ message: 'Postcode is required for Great Britain addresses' })
  @Matches(UK_POSTCODE_PATTERN)
  @Transform(({ value, obj }) =>
    obj.countryIsoCode === 'GB' && typeof value === 'string'
      ? normalizeUkPostcode(value)
      : value,
  )
  postcode?: string;

  @IsOptional() @IsString() county?: string;
  @IsOptional() @IsString() uprn?: string;
  @IsOptional() @IsLatitude() latitude?: number;
  @IsOptional() @IsLongitude() longitude?: number;
  @IsOptional() @IsString() provider?: string;
  @IsOptional() @IsString() providerRef?: string;
}
