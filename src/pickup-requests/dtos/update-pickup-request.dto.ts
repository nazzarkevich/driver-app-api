import { PickupRequestStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class UpdatePickupRequestDto {
  @IsString()
  @IsOptional()
  clientName?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  postcode?: string;

  @IsInt()
  @IsPositive()
  @Min(1)
  @IsOptional()
  parcelCount?: number;

  @IsDateString()
  @IsOptional()
  scheduledDate?: string;

  @IsEnum(PickupRequestStatus)
  @IsOptional()
  status?: PickupRequestStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}
