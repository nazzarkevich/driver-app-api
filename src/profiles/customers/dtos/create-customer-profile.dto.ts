import { Gender, Phone } from '@prisma/client';
import {
  IsOptional,
  IsString,
  IsNotEmpty,
  IsEnum,
  ValidateNested,
} from 'class-validator';

import { CreateAddressDto } from 'src/dtos/create-address.dto';

// TODO: Add NovaPoshta details
export class CreateCustomerProfileDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsEnum(Gender)
  @IsNotEmpty()
  gender: Gender;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phoneNumber: Phone;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  countryCode: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  note: string;

  @IsNotEmpty()
  @ValidateNested({ each: true })
  address: CreateAddressDto;
}
