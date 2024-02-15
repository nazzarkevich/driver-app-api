import {
  UserType,
  Gender,
  DriverProfile,
  CustomerProfile,
  Business,
} from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';

export class UserDto {
  @Expose()
  id: number;

  @Exclude()
  password: string;

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
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  imageUrl: string;

  @Expose()
  driverProfile: DriverProfile;

  @Expose()
  customerProfile: CustomerProfile;

  @Expose()
  Business: Business;

  constructor(partial: Partial<UserDto>) {
    Object.assign(this, partial);
  }
}
