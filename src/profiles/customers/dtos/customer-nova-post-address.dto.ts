import {
  IsBoolean,
  IsInt,
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

export class UpdateCustomerNovaPostAddressDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  label?: string;

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
