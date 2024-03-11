import {
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateJourneyDto {
  @IsString()
  @IsNotEmpty()
  startLocation: string;

  @IsString()
  @IsNotEmpty()
  endLocation: string;

  @IsOptional()
  parcels: number[];

  @IsNumber()
  @IsNotEmpty()
  driverIds: number[];

  @IsNumber()
  @IsNotEmpty()
  vehicleId: number;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  notes: string;

  @IsDate()
  @IsNotEmpty()
  departureDate: Date;
}
