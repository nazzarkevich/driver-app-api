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
  addresses: AddressWithCountryDto[];
  gender?: Gender | null;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: any) {
    Object.assign(this, partial);

    if (partial?.addresses) {
      this.addresses = partial.addresses.map(
        (a: any) => new AddressWithCountryDto(a),
      );
      const primary = partial.addresses.find((a: any) => a.isPrimary);
      if (primary) this.address = new AddressWithCountryDto(primary);
    }

    if (partial?.notes) {
      this.notes = partial.notes.map((n: any) => new CustomerNoteDto(n));
    }
  }
}
