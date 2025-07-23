import { Parcel, Vehicle } from '@prisma/client';
import { Expose, Type } from 'class-transformer';
import { DriverProfileWithUserDto } from './driver-profile-with-user.dto';

@Expose()
export class JourneyDto {
  id: number;
  journeyNumber: string;
  startLocation: string;
  endLocation: string;
  parcels: Parcel[];
  @Type(() => DriverProfileWithUserDto)
  driverProfiles: DriverProfileWithUserDto[];
  businessId: number;
  vehicle: Vehicle;
  notes: string;
  isCompleted: boolean;
  departureDate: Date;
  arrivalDate: Date;
  createdAt: Date;
  updatedAt: Date;

  // Computed properties for backward compatibility
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
