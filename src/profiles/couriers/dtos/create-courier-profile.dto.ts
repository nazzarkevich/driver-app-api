import { IsNotEmpty, IsNumber } from 'class-validator';

export class CreateCourierProfileDto {
  @IsNotEmpty()
  @IsNumber()
  userId: number;
}
