import {
  IsOptional,
  IsNumber,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ParcelItemDto } from './parcel-item.dto';
import { ParcelDestinationDto } from './parcel-destination.dto';

export class CreateBulkParcelsDto {
  @IsNumber()
  @IsNotEmpty()
  senderId: number;

  @IsNumber()
  @IsNotEmpty()
  recipientId: number;

  @ValidateNested()
  @Type(() => ParcelDestinationDto)
  @IsNotEmpty()
  origin: ParcelDestinationDto;

  @ValidateNested()
  @Type(() => ParcelDestinationDto)
  @IsNotEmpty()
  destination: ParcelDestinationDto;

  @IsNumber()
  @IsOptional()
  journeyId?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => ParcelItemDto)
  parcels: ParcelItemDto[];
}
