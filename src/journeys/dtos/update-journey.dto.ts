import {
  IsArray,
  IsBoolean,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

// TODO: Question: how to update the parcels in the journey?

export class UpdateJourneyDto {
  @IsNumber()
  @IsOptional()
  startCountryId: number;

  @IsNumber()
  @IsOptional()
  endCountryId: number;

  //   @IsOptional()
  //   parcels: number[];

  @IsNumber()
  @IsOptional()
  driverId: number;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  driverProfiles: number[];

  @IsNumber()
  @IsOptional()
  vehicleId: number;

  @IsString()
  @IsOptional()
  notes: string;

  @IsDate()
  @IsOptional()
  departureDate: Date;

  @IsBoolean()
  @IsOptional()
  isCompleted: boolean;

  @IsBoolean()
  @IsOptional()
  hasTrailer: boolean;
}
