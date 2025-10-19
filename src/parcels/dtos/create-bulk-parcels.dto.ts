import {
  IsString,
  IsOptional,
  IsNumber,
  IsDate,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ParcelItemDto } from './parcel-item.dto';

export class CreateBulkParcelsDto {
  @IsNumber()
  @IsNotEmpty()
  senderId: number;

  @IsNumber()
  @IsNotEmpty()
  recipientId: number;

  @IsString()
  @IsNotEmpty()
  recipientPhoneNumber: string;

  @IsString()
  @IsNotEmpty()
  senderPhoneNumber: string;

  @IsNumber()
  @IsNotEmpty()
  originAddressId: number;

  @IsNumber()
  @IsNotEmpty()
  destinationAddressId: number;

  @IsNumber()
  @IsOptional()
  journeyId?: number;

  @IsDate()
  @IsNotEmpty()
  @Type(() => Date)
  pickupDate: Date;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => ParcelItemDto)
  parcels: ParcelItemDto[];
}
