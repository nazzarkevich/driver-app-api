import { Parcel, Vehicle, Country, JourneyStatus } from '@prisma/client';
import { Expose, Type } from 'class-transformer';
import { DriverProfileWithUserDto } from './driver-profile-with-user.dto';

@Expose()
export class JourneyDto {
  id: number;
  journeyNumber: string;
  startCountryId: number;
  endCountryId: number;
  startCountry: Country;
  endCountry: Country;
  parcels: Parcel[];
  @Type(() => DriverProfileWithUserDto)
  driverProfiles: DriverProfileWithUserDto[];
  businessId: number;
  vehicle: Vehicle;
  isCompleted: boolean;
  status: JourneyStatus;
  actualDepartureAt: Date | null;
  closedAt: Date | null;
  closedByUserId: number | null;
  hasTrailer: boolean;
  departureDate: Date;
  arrivalDate: Date;
  createdAt: Date;
  updatedAt: Date;
  notes: string | null;

  // Computed properties for backward compatibility
  get startLocation(): string {
    return this.startCountry?.name || '';
  }

  get endLocation(): string {
    return this.endCountry?.name || '';
  }

  get origin(): string {
    return this.startLocation;
  }

  get destination(): string {
    return this.endLocation;
  }

  constructor(
    partial: Partial<JourneyDto> & {
      journeyNotes?: { content: string }[];
    },
  ) {
    Object.assign(this, partial);
    this.notes = partial.journeyNotes?.[0]?.content ?? null;
  }
}
