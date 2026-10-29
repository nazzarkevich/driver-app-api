import {
  IsInt,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class TrackingLookupDto {
  @IsInt()
  @Min(1)
  businessId: number;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  trackingNumber: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  postcode: string;
}

export class TrackingResolveDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  token: string;
}
