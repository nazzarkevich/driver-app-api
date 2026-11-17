import { IsStaffPassword } from '../../staff-password.validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsEmail,
} from 'class-validator';

export class CreateCourierWithUserDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  phoneNumber: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  phoneCountryCode: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @IsStaffPassword()
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  imageId?: number;
}
