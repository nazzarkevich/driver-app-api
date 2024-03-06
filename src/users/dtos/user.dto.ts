import { UserType, Gender } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';

@Expose()
export class UserDto {
  @Exclude()
  isAdmin: boolean;

  @Exclude()
  password: string;

  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  type: UserType;
  isBlocked: boolean;
  gender: Gender;
  createdAt: Date;
  updatedAt: Date;
  driverProfileId?: number;
  courierProfileId?: number;
  customerProfileId: number;
  businessId: number;
  imageId: number;

  constructor(partial: Partial<UserDto>) {
    Object.assign(this, partial);
  }
}
