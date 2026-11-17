import { IsStaffPassword } from '../../staff-password.validator';
import { IsString, IsOptional, IsEmail } from 'class-validator';

export class UpdateDriverProfileDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsStaffPassword()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  phoneCountryCode?: string;
}
