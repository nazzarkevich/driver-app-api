import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class TransitionJourneyDto {
  @IsDateString()
  expectedUpdatedAt: string;
}

export class CancelJourneyDto extends TransitionJourneyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class ReverseJourneyStatusDto extends CancelJourneyDto {}
