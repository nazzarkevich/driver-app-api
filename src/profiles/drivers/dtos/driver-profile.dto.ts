import { Journey } from '@prisma/client';
import { Expose } from 'class-transformer';

@Expose()
export class DriverProfileDto {
  id: number;
  userId: number;
  journeys: Journey[];
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<DriverProfileDto>) {
    Object.assign(this, partial);
  }
}
