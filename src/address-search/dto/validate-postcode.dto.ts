import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class ValidatePostcodeDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 12)
  postcode: string;
}
