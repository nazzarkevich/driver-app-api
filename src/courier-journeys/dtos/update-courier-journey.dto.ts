import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

// TODO: Question: how to update the parcels in the journey?

export class UpdateCourierJourneyDto {
  @IsString()
  @IsOptional()
  destination: string;

  //   @IsOptional()
  //   parcels: number[];

  @IsNumber()
  @IsOptional()
  courierId: number;

  @IsNumber()
  @IsOptional()
  vehicleId: number;

  @IsBoolean()
  @IsOptional()
  isCompleted: boolean;
}
