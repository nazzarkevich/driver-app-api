import {
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateCourierJourneyDto {
  @IsOptional()
  parcels: number[];

  @IsNotEmpty()
  couriersIds: number[];

  @IsString()
  @IsNotEmpty()
  destination: string;

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
