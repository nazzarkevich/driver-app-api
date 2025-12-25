import { Gender } from '@prisma/client';
import {
  IsOptional,
  IsString,
  IsNotEmpty,
  IsEnum,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

import { CreateAddressDto } from 'src/dtos/create-address.dto';
import { CreatePhoneDto } from 'src/dtos/create-phone.dto';

// TODO: Add NovaPoshta details
export class CreateCustomerProfileDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ValidateIf((o) => o.gender !== null && o.gender !== undefined && o.gender !== '')
  @IsEnum(Gender)
  gender?: Gender;

  @ValidateNested()
  @Type(() => CreatePhoneDto)
  @IsNotEmpty()
  phoneNumber: CreatePhoneDto;

  @IsNotEmpty()
  @ValidateNested({ each: true })
  address: CreateAddressDto;
}
