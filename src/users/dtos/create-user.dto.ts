import { ApiProperty } from '@nestjs/swagger';
import { Gender, UserType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  IsDate,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @ApiProperty({ example: 'John', description: 'first name of the user' })
  @Transform((param) => param.value.toLowerCase())
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  password: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  lastName: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsDate()
  dateOfBirth: Date;

  @IsEnum(Gender)
  gender: Gender;

  @IsEnum(UserType)
  type: UserType;
}
