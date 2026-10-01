import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsEmail,
  IsString,
  IsNotEmpty,
  IsOptional,
  MinLength,
  IsDate,
  ValidateIf,
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

  @ApiPropertyOptional({
    example: '+44',
    description: 'Phone number country code',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  countryCode?: string;

  @ApiPropertyOptional({
    example: '07950 999 888',
    description: 'Users phone number',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: '1995-05-08',
    description: 'Users date of birth',
  })
  @IsOptional()
  @IsDate()
  dateOfBirth?: Date;

  @ApiPropertyOptional({
    example: 'Male',
    description: 'Users gender',
  })
  @IsOptional()
  @ValidateIf(
    (o) => o.gender !== null && o.gender !== undefined && o.gender !== '',
  )
  @IsEnum(Gender)
  gender?: Gender;
}
