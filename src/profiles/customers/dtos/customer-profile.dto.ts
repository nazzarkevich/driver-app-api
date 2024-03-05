import { Gender, Parcel, Address, User } from '@prisma/client';
import { Expose } from 'class-transformer';

@Expose()
export class CustomerProfileDto {
  id: number;
  businessId: number;
  parcelsSent: Parcel[];
  parcelsReceived: Parcel[];
  phoneNumberUa?: string;
  phoneNumberUk?: string;
  note?: string;
  address?: Address;
  user?: User;
  firstName: string;
  lastName: string;
  gender: Gender;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<CustomerProfileDto>) {
    Object.assign(this, partial);
  }
}
