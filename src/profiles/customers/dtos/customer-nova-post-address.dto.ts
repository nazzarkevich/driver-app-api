import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  Min,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateCustomerNovaPostAddressDto {
  @IsInt()
  warehouseId: number;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  label?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  recipientName?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  recipientPhone?: string;
}

export const normalizeNovaPostLabel = (value: string | null | undefined) =>
  typeof value === 'string' ? value.trim() || null : value;

export class UpdateCustomerNovaPostAddressDto {
  @Transform(({ value }) => normalizeNovaPostLabel(value))
  @IsString()
  @IsOptional()
  label?: string | null;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  recipientName?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  recipientPhone?: string;
}

export class ArchiveCustomerNovaPostAddressDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  replacementDefaultAddressId?: number;
}

export class ReplaceCustomerNovaPostAddressDto {
  @IsInt()
  @Min(1)
  warehouseId: number;

  @Transform(({ value }) => normalizeNovaPostLabel(value))
  @IsOptional()
  @IsString()
  label?: string | null;
}
