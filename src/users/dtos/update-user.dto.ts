import { ApiProperty } from '@nestjs/swagger';
import { Gender } from '@prisma/client';
import { IsEnum, IsEmail, IsString, IsOptional, IsDate } from 'class-validator';

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

  @ApiProperty({
    example: '07950 999 888',
    description: 'Users phone number',
  })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

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

  // @IsEnum(UserType)
  // @IsOptional()
  // type: UserType;

  // @IsBoolean()
  // @IsOptional()
  // isBlocked: boolean;
}
