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
export class DriverProfileWithUserDto {
  @ApiProperty({
    example: 1,
    description: 'Driver profile ID',
  })
  id: number;

  @ApiProperty({
    description: 'User information including name and image',
  })
  user: UserData;

  @ApiProperty({
    description: 'When the driver profile was created',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When the driver profile was last updated',
  })
  updatedAt: Date;

  constructor(partial: Partial<DriverProfileWithUserDto>) {
    Object.assign(this, partial);
  }
}
