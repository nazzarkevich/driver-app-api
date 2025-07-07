import { Journey } from '@prisma/client';
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
export class DriverProfileDto {
  @ApiProperty({
    example: 1,
    description: 'Driver profile ID',
  })
  id: number;

  @ApiProperty({
    example: 123,
    description: 'User ID associated with this driver profile',
  })
  userId: number;

  @ApiProperty({
    description: 'User information including name and image',
  })
  user: UserData;

  @ApiProperty({
    description: 'Journeys assigned to this driver',
  })
  journeys: Journey[];

  @ApiProperty({
    description: 'When the driver profile was created',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When the driver profile was last updated',
  })
  updatedAt: Date;

  constructor(partial: Partial<DriverProfileDto>) {
    Object.assign(this, partial);
  }
}
