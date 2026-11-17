import { OmitType, PartialType } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { CreateTariffDto } from './create-tariff.dto';

export class UpdateTariffDto extends PartialType(
  OmitType(CreateTariffDto, ['pricePerKg', 'weightThreshold'] as const),
) {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  pricePerKg?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(9999999.999)
  weightThreshold?: number | null;
}
