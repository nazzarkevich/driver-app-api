import { Gender } from '@prisma/client';
import {
  IsEnum,
  IsEmail,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
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

  @IsDateString()
  dateOfBirth: string;

  @IsEnum(Gender)
  gender: Gender;
}
