import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsIn,
  MinLength,
} from 'class-validator';

export class CreateBusinessWithAdminDto {
  @IsNotEmpty()
  @IsString()
  businessName: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn(['GBP', 'EUR', 'UAH'])
  currency?: string;

  @IsNotEmpty()
  @IsString()
  adminFirstName: string;

  @IsNotEmpty()
  @IsString()
  adminLastName: string;

  @IsEmail()
  adminEmail: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  adminPassword: string;

  @IsOptional()
  @IsString()
  adminPhoneNumber?: string;

  @IsOptional()
  @IsString()
  adminCountryCode?: string;
}
