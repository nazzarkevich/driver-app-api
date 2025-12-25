import { Parcel, Vehicle, Country } from '@prisma/client';
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
  hasTrailer: boolean;
  departureDate: Date;
  arrivalDate: Date;
  createdAt: Date;
  updatedAt: Date;

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

  constructor(partial: Partial<JourneyDto>) {
    Object.assign(this, partial);
  }
}
