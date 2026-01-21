import { Parcel } from '@prisma/client';
import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

interface UserData {
  id: number;
  firstName: string;
  lastName: string;
  imageUrl?: {
    id: number;
    url: string;
  };
}

@Expose()
export class CourierProfileDto {
  @ApiProperty({
    example: 1,
    description: 'Courier profile ID',
  })
  id: number;

  @ApiProperty({
    example: 123,
    description: 'User ID associated with this courier profile',
  })
  userId: number;

  @ApiProperty({
    description: 'User information including name and image',
  })
  user: UserData;

  @ApiProperty({
    description: 'Parcels assigned to this courier',
  })
  parcels: Parcel[];

  @ApiProperty({
    description: 'Parcels picked up by this courier',
  })
  parcelsPickedUp: Parcel[];

  @ApiProperty({
    description: 'Parcels delivered by this courier',
  })
  parcelsDelivered: Parcel[];

  @ApiProperty({
    description: 'When the courier profile was created',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When the courier profile was last updated',
  })
  updatedAt: Date;

  constructor(partial: Partial<CourierProfileDto>) {
    Object.assign(this, partial);
  }
}
