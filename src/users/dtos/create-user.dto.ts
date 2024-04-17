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

// TODO: add password confirmation
export class CreateUserDto {
  @ApiProperty({
    example: 'john@gmail.com',
    description: 'Email address of the user',
  })
  @IsEmail()
  @Transform((param) => param.value.toLowerCase())
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'Users password',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  password: string;

  @ApiProperty({
    example: 'John',
    description: 'Users name',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  firstName: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Users last name',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  lastName: string;

  @ApiProperty({
    example: '+44',
    description: 'Phone number country code',
  })
  @IsString()
  @IsNotEmpty()
  countryCode: string;

  @ApiProperty({
    example: '07950 999 888',
    description: 'Users phone number',
  })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({
    example: '1995-05-08',
    description: 'Users date of birth',
  })
  @IsDate()
  dateOfBirth: Date;

  @ApiProperty({
    example: 'Male',
    description: 'Users gender',
  })
  @IsEnum(Gender)
  gender: Gender;

  @ApiProperty({
    example: 'Manager',
    description: 'Users role',
  })
  @IsEnum(UserType)
  type: UserType;
}
