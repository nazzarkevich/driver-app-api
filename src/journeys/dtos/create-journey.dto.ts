import {
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateJourneyDto {
  @IsNumber()
  @IsNotEmpty()
  startCountryId: number;

  @IsNumber()
  @IsNotEmpty()
  endCountryId: number;

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
