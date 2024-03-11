import { DriverProfile, Parcel, Vehicle } from '@prisma/client';
import { Expose } from 'class-transformer';

@Expose()
export class JourneyDto {
  startLocation: string;
  endLocation: string;
  parcels: Parcel[];
  driverProfiles: DriverProfile[];
  vehicle: Vehicle;
  notes: string;
  isCompleted: boolean;
  departureDate: Date;
  arrivalDate: Date;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<JourneyDto>) {
    Object.assign(this, partial);
  }
}
