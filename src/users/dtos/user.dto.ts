import {
  UserType,
  Gender,
  DriverProfile,
  CustomerProfile,
  Business,
} from '@prisma/client';
import { Expose } from 'class-transformer';

export class UserDto {
  @Expose()
  id: number;

  @Expose()
  email: string;

  @Expose()
  name: string;

  @Expose()
  lastName: string;

  @Expose()
  phoneNumberUa: string;

  @Expose()
  phoneNumberUk: string;

  @Expose()
  type: UserType;

  @Expose()
  isBlocked: boolean;

  @Expose()
  isAdmin: boolean;

  @Expose()
  gender: Gender;

  @Expose()
  createdAt: string;

  @Expose()
  updatedAt: string;

  @Expose()
  imageUrl: string;

  @Expose()
  driverProfile: DriverProfile;

  @Expose()
  customerProfile: CustomerProfile;

  @Expose()
  Business: Business;
}
