import { PartialType } from '@nestjs/swagger';
import { CreateParcelTypeDto } from './create-parcel-type.dto';

export class UpdateParcelTypeDto extends PartialType(CreateParcelTypeDto) {}
