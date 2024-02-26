import { IsString, IsOptional } from 'class-validator';

export class UpdateBusinessDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description: string;
}
