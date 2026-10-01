import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SearchNovaPostWarehousesDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  cityRef?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 25;
}
