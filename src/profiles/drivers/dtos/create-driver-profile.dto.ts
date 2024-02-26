import { IsNotEmpty, IsNumber } from 'class-validator';

export class CreateDriverProfileDto {
  @IsNotEmpty()
  @IsNumber()
  userId: number;
}
