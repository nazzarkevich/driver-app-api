import { Parcel } from '@prisma/client';

export class CourierProfileDto {
  userId: number;
  parcels: Parcel[];
  createdAt: Date;
  updatedAt: Date;
}
