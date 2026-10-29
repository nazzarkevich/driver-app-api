import { CustomerProfileDto } from './customer-profile.dto';

export class RecipientSuggestionDto {
  customer: CustomerProfileDto;
  parcelCount: number;
  lastParcelAt: Date;

  constructor(partial: RecipientSuggestionDto) {
    Object.assign(this, partial);
  }
}
