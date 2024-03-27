import { CourierProfile, Parcel, Vehicle } from '@prisma/client';
import { Expose } from 'class-transformer';

@Expose()
export class CourierJourneyDto {
  destination: string;
  parcels: Parcel[];
  courierProfiles: CourierProfile[];
  vehicle: Vehicle;
  notes: string;
  isCompleted: boolean;
  departureDate: Date;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<CourierJourneyDto>) {
    Object.assign(this, partial);
  }
}
