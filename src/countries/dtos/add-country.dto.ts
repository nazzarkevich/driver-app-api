import { IsNotEmpty, IsString } from 'class-validator';

export class AddCountryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  isoCode: string;
}
