import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class CreatePickupRequestDto {
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  postcode: string;

  @IsInt()
  @IsPositive()
  @Min(1)
  @IsOptional()
  parcelCount?: number;

  @IsDateString()
  scheduledDate: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
