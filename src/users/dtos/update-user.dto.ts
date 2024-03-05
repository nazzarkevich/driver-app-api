import { Gender } from '@prisma/client';
import { IsEnum, IsEmail, IsString, IsOptional, IsDate } from 'class-validator';

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email: string;

  @IsString()
  @IsOptional()
  password: string;

  @IsString()
  @IsOptional()
  firstName: string;

  @IsString()
  @IsOptional()
  lastName: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsDate()
  @IsOptional()
  dateOfBirth: Date;

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
