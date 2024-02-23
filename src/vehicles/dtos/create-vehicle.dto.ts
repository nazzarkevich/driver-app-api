import { IsString, IsNotEmpty, MinLength, IsDate } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  plateNumber: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  model: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  make: string;

  @IsDate()
  year: Date;
}
