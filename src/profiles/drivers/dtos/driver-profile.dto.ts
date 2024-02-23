import { Journey } from '@prisma/client';

export class DriverProfileDto {
  userId: number;
  journeys: Journey[];
  createdAt: Date;
  updatedAt: Date;
}
