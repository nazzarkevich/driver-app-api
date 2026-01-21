import { Gender } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsString,
  IsOptional,
  IsBoolean,
  ValidateNested,
} from 'class-validator';

class UpdatePhoneDto {
  @IsString()
  @IsOptional()
  number?: string;

  @IsString()
  @IsOptional()
  countryCode?: string;
}

class UpdateAddressDto {
  @IsString()
  @IsOptional()
  street?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  countryIsoCode?: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  @IsOptional()
  postcode?: string;

  @IsString()
  @IsOptional()
  building?: string;

  @IsString()
  @IsOptional()
  flat?: string;

  @IsString()
  @IsOptional()
  village?: string;
}

export class UpdateCustomerProfileDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ValidateNested()
  @Type(() => UpdatePhoneDto)
  @IsOptional()
  phoneNumber?: UpdatePhoneDto;

  @ValidateNested()
  @Type(() => UpdateAddressDto)
  @IsOptional()
  address?: UpdateAddressDto;
}
