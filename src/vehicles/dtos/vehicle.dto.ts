import { Journey } from '@prisma/client';
import { Expose } from 'class-transformer';

@Expose()
export class VehicleDto {
  id: number;
  plateNumber: string;
  model: string;
  make: string;
  year: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  journeys: Journey[];
  businessId: number;

  constructor(partial: Partial<VehicleDto>) {
    Object.assign(this, partial);
  }
}
