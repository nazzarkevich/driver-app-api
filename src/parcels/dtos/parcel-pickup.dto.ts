import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class ParcelPickupCollectorDto {
  @IsIn(['Self', 'Driver', 'Courier'])
  type: 'Self' | 'Driver' | 'Courier';

  @ValidateIf((value) => value.type !== 'Self')
  @IsInt()
  @Min(1)
  profileId?: number;
}

export class ParcelPickupDto {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ParcelPickupCollectorDto)
  collector: ParcelPickupCollectorDto;

  @IsOptional()
  @IsDateString({ strict: true })
  pickedUpAt?: string;
}
