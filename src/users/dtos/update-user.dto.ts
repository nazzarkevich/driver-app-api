import { Gender, UserType } from '@prisma/client';
import {
  IsEnum,
  IsEmail,
  IsString,
  IsOptional,
  IsDateString,
  IsBoolean,
} from 'class-validator';

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email: string;

  @IsString()
  @IsOptional()
  password: string;

  @IsString()
  @IsOptional()
  name: string;

  @IsString()
  @IsOptional()
  lastName: string;

  @IsString()
  @IsOptional()
  phoneNumberUa?: string;

  @IsString()
  @IsOptional()
  phoneNumberUk?: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth: Date;

  @IsEnum(Gender)
  @IsOptional()
  gender: Gender;

  @IsEnum(UserType)
  @IsOptional()
  type: UserType;

  @IsBoolean()
  @IsOptional()
  isBlocked: boolean;
}
