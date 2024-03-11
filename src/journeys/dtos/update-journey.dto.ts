import {
  IsBoolean,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

// TODO: Question: how to update the parcels in the journey?

export class UpdateJourneyDto {
  @IsString()
  @IsOptional()
  startLocation: string;

  @IsString()
  @IsOptional()
  endLocation: string;

  //   @IsOptional()
  //   parcels: number[];

  @IsNumber()
  @IsOptional()
  driverId: number;

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
}
