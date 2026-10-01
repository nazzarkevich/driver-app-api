import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsLatitude,
  IsLongitude,
  Matches,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { IsCityOrVillage } from 'src/validators/is-city-or-village.validator';
import {
  normalizeUkPostcode,
  UK_POSTCODE_PATTERN,
} from 'src/address-search/utils/uk-postcode';

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
  @Matches(UK_POSTCODE_PATTERN)
  @Transform(({ value, obj }) =>
    obj.countryIsoCode === 'GB' && typeof value === 'string'
      ? normalizeUkPostcode(value)
      : value,
  )
  postcode?: string;

  @ValidateIf((value) => !value.line1)
  @IsString()
  @IsNotEmpty()
  street?: string;

  @ValidateIf((value) => !value.street)
  @IsString()
  @IsNotEmpty()
  line1?: string;

  @IsOptional() @IsString() line2?: string;
  @IsOptional() @IsString() line3?: string;
  @IsOptional() @IsString() county?: string;
  @IsOptional() @IsString() uprn?: string;
  @IsOptional() @IsLatitude() latitude?: number;
  @IsOptional() @IsLongitude() longitude?: number;
  @IsOptional() @IsString() provider?: string;
  @IsOptional() @IsString() providerRef?: string;

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
  @IsIn(['GB', 'UA'])
  countryIsoCode: string;

  @IsNumber()
  @IsOptional()
  profileId?: number;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}
