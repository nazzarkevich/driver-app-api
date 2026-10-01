import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class SearchAddressDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 150)
  query: string;
}
