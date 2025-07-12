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
  @IsNumber({}, { each: true })
  parcels: number[];

  @IsNotEmpty()
  @IsNumber({}, { each: true })
  driverProfiles: number[];

  @IsNumber()
  @IsNotEmpty()
  vehicleId: number;

  @IsString()
  @IsOptional()
  notes: string;

  @IsDate()
  @IsNotEmpty()
  departureDate: Date;
}
