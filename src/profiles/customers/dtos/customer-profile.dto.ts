import { Gender, Parcel, Phone } from '@prisma/client';
import { Expose } from 'class-transformer';
import { CustomerNoteDto } from './customer-note.dto';
import { AddressWithCountryDto } from 'src/parcels/dtos/address-with-country.dto';

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
  address?: AddressWithCountryDto;
  gender?: Gender | null;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: any) {
    Object.assign(this, partial);

    if (partial?.primaryAddress) {
      this.address = new AddressWithCountryDto(partial.primaryAddress);
    }
  }
}
