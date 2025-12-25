import { Gender, Parcel, Address, Phone } from '@prisma/client';
import { Expose } from 'class-transformer';
import { CustomerNoteDto } from './customer-note.dto';

interface UserData {
  id: number;
  firstName: string;
  lastName: string;
  isBlocked: boolean;
}

@Expose()
export class CustomerProfileDto {
  id: number;
  firstName: string;
  lastName: string;
  businessId: number;
  parcelsSent: Parcel[];
  parcelsReceived: Parcel[];
  phoneNumber: Phone;
  notes?: CustomerNoteDto[];
  address?: Address;
  user?: UserData;
  gender?: Gender | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<CustomerProfileDto>) {
    Object.assign(this, partial);
  }
}
