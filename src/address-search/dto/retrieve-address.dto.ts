import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

export class RetrieveAddressDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 200)
  @Matches(/^[A-Za-z0-9_|-]+$/)
  id: string;
}
