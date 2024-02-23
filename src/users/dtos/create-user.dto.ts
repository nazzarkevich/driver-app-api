import { Gender, UserType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsEmail,
  IsString,
  IsNotEmpty,
  IsOptional,
  MinLength,
  IsDate,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @Transform((param) => param.value.toLowerCase())
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  password: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  lastName: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phoneNumberUa?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phoneNumberUk?: string;

  @IsDate()
  dateOfBirth: Date;

  @IsEnum(Gender)
  gender: Gender;

  @IsEnum(UserType)
  type: UserType;
}
