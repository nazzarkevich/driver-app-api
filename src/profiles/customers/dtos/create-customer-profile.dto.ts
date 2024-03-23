import { Gender } from '@prisma/client';
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
  phoneNumberUa: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phoneNumberUk: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  note: string;

  @IsNotEmpty()
  @ValidateNested({ each: true })
  address: CreateAddressDto;
}
