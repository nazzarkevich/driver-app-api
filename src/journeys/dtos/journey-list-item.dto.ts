import { OmitType } from '@nestjs/swagger';
import { JourneyDto } from './journey.dto';

export class JourneyListItemDto extends OmitType(JourneyDto, ['parcels'] as const) {
  parcelCount: number;
}
