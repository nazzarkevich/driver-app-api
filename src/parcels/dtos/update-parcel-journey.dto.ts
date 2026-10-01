import { IsEnum, IsInt, ValidateIf } from 'class-validator';

export enum ParcelJourneyScope {
  Parcel = 'parcel',
  Group = 'group',
}

export class UpdateParcelJourneyDto {
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  journeyId: number | null;

  @IsEnum(ParcelJourneyScope)
  scope: ParcelJourneyScope;
}
