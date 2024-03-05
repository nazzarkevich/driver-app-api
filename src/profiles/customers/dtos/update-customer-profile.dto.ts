import { Gender } from '@prisma/client';
import { IsEnum, IsString, IsOptional } from 'class-validator';

// TODO: investigate how to update nested table
export class UpdateCustomerProfileDto {
  //   @IsOptional()
  //   address?: Address;

  @IsString()
  @IsOptional()
  firstName: string;

  @IsString()
  @IsOptional()
  lastName: string;

  @IsString()
  @IsOptional()
  phoneNumberUa: string;

  @IsString()
  @IsOptional()
  phoneNumberUk: string;

  @IsString()
  @IsOptional()
  note: string;

  @IsEnum(Gender)
  @IsOptional()
  gender: Gender;
}
