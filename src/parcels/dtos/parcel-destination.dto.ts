import { ParcelDestinationType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  ValidateIf,
} from 'class-validator';

export class ParcelDestinationDto {
  @IsEnum(ParcelDestinationType)
  type: ParcelDestinationType;

  @ValidateIf((value) => value.type === ParcelDestinationType.CustomerAddress)
  @IsInt()
  @IsNotEmpty()
  addressId?: number;

  @ValidateIf((value) => value.type === ParcelDestinationType.NovaPostWarehouse)
  @IsInt()
  @IsNotEmpty()
  warehouseId?: number;

  @IsInt()
  @IsOptional()
  customerNovaPostAddressId?: number;

  @IsBoolean()
  @IsOptional()
  saveToCustomerProfile?: boolean;
}
