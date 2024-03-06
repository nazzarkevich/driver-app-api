import { Parcel } from '@prisma/client';

export class CourierProfileDto {
  userId: number;
  parcels: Parcel[];
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<CourierProfileDto>) {
    Object.assign(this, partial);
  }
}
