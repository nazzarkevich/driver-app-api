import {
  User,
  Parcel,
  Vehicle,
  Journey,
  CustomerProfile,
} from '@prisma/client';
import { Expose } from 'class-transformer';

@Expose()
export class BusinessDto {
  id: number;
  name: string;
  users: User[];
  journeys: Journey[];
  vehicles: Vehicle[];
  parcels: Parcel[];
  customerProfiles: CustomerProfile[];
  notes: string;
  activationDate: Date;
  isActive: boolean;
  description: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<BusinessDto>) {
    Object.assign(this, partial);
  }
}
