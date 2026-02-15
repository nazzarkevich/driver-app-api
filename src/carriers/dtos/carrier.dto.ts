import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

interface CarrierUserData {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  isBlocked?: boolean;
  phoneNumber?: {
    number: string;
    countryCode: string;
  } | null;
  imageUrl?: {
    id: number;
    url: string;
  };
}

@Expose()
export class CarrierDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'courier', enum: ['courier', 'driver'] })
  type: 'courier' | 'driver';

  @ApiProperty({ example: 123 })
  userId: number;

  @ApiProperty()
  user: CarrierUserData;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<CarrierDto>) {
    Object.assign(this, partial);
  }
}
