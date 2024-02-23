import { UserType, Gender } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';

import { DriverProfileDto } from 'src/profiles/drivers/dtos/driver-profile.dto';

@Expose()
export class UserDto {
  @Exclude()
  isAdmin: boolean;

  @Exclude()
  password: string;

  id: number;
  email: string;
  name: string;
  lastName: string;
  phoneNumberUa: string;
  phoneNumberUk: string;
  type: UserType;
  isBlocked: boolean;
  gender: Gender;
  createdAt: Date;
  updatedAt: Date;
  driverProfile?: DriverProfileDto;
  customerProfileId: number;
  businessId: number;
  imageId: number;

  constructor(partial: Partial<UserDto>) {
    Object.assign(this, partial);
  }
}
