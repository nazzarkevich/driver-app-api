import { Gender, Parcel, Address, User, Phone } from '@prisma/client';
import { Expose } from 'class-transformer';

@Expose()
export class CustomerProfileDto {
  id: number;
  firstName: string;
  lastName: string;
  businessId: number;
  parcelsSent: Parcel[];
  parcelsReceived: Parcel[];
  phoneNumber: Phone;
  note?: string;
  address?: Address;
  user?: User;
  gender: Gender;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<CustomerProfileDto>) {
    Object.assign(this, partial);
  }
}
