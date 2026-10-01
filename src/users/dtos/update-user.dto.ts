import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { Gender, UserType } from '@prisma/client';
import {
  IsDate,
  IsEmail,
  IsEmpty,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

// TODO: Question: how to update phone number?
export class UpdateUserDto {
  @ApiProperty({
    example: 'john@gmail.com',
    description: 'Users email address',
  })
  @IsEmail()
  @IsOptional()
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'Users password',
  })
  @IsString()
  @IsOptional()
  password: string;

  @ApiProperty({
    example: 'John',
    description: 'Users name',
  })
  @IsString()
  @IsOptional()
  firstName: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Users last name',
  })
  @IsString()
  @IsOptional()
  lastName: string;

  // @ApiProperty({
  //   example: '07950 999 888',
  //   description: 'Users phone number',
  // })
  // @IsString()
  // @IsOptional()
  // phoneNumber?: string;

  @ApiProperty({
    example: '1995-05-08',
    description: 'Users date of birth',
  })
  @IsDate()
  @IsOptional()
  dateOfBirth: Date;

  @ApiProperty({
    example: 'Male',
    description: 'Users gender',
  })
  @IsEnum(Gender)
  @IsOptional()
  gender: Gender;

  @ApiHideProperty()
  @IsEmpty({ message: 'User role must be changed through the role endpoint' })
  type?: UserType;

  @ApiHideProperty()
  @IsEmpty({ message: 'isAdmin cannot be changed through the API' })
  isAdmin?: boolean;

  @ApiHideProperty()
  @IsEmpty({ message: 'isSuperAdmin cannot be changed through the API' })
  isSuperAdmin?: boolean;

  // @IsBoolean()
  // @IsOptional()
  // isBlocked: boolean;
}
