import { PartialType } from '@nestjs/swagger';
import { CreateTariffGroupDto } from './create-tariff-group.dto';

export class UpdateTariffGroupDto extends PartialType(CreateTariffGroupDto) {}
