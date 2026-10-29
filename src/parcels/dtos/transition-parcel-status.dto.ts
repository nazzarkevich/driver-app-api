import { DeliveryStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class TransitionParcelStatusDto {
  @IsEnum(DeliveryStatus)
  toStatus: DeliveryStatus;

  @IsDateString()
  expectedUpdatedAt: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  novaPostTrackingNumber?: string;
}

export class ReverseParcelStatusDto {
  @IsDateString()
  expectedUpdatedAt: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class CorrectParcelStatusDto {
  @IsEnum(DeliveryStatus)
  toStatus: DeliveryStatus;

  @IsDateString()
  expectedUpdatedAt: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  novaPostTrackingNumber?: string;
}

export class ReportParcelDamageDto extends ReverseParcelStatusDto {}

export class ResolveParcelDamageDto {
  @IsDateString()
  expectedUpdatedAt: string;
}
