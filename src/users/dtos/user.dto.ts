import { ApiProperty } from '@nestjs/swagger';
import { UserType, Gender } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';

@Expose()
export class UserDto {
  @Exclude()
  isAdmin: boolean;

  @ApiProperty({
    example: '3',
    description: 'Users id',
  })
  id: number;

  @ApiProperty({
    example: 'abc123-def456-ghi789',
    description: 'Supabase user ID',
  })
  supabaseId?: string;

  @ApiProperty({
    example: 'john@gmail.com',
    description: 'Users email address',
  })
  email: string;

  @ApiProperty({
    example: 'John',
    description: 'Users name',
  })
  firstName: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Users last name',
  })
  lastName: string;

  // @ApiProperty({
  //   example: '07950 999 888',
  //   description: 'Users phone number',
  // })
  // phoneNumber: string;

  @ApiProperty({
    example: 'Manager',
    description: 'Users role',
  })
  type: UserType;

  @ApiProperty({
    example: false,
    description: 'Users suspended status',
  })
  isBlocked: boolean;

  @ApiProperty({
    example: 'Male',
    description: 'Users gender',
  })
  gender: Gender;

  @ApiProperty({
    description: 'When user was created',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When users details were updated',
  })
  updatedAt: Date;

  @ApiProperty({
    example: 45,
    description: 'Users driverProfileId',
  })
  driverProfileId?: number;

  @ApiProperty({
    example: 99,
    description: 'Users courierProfileId',
  })
  courierProfileId?: number;

  @ApiProperty({
    example: 5,
    description: 'Users customerProfileId',
  })
  customerProfileId: number;

  @ApiProperty({
    example: 15,
    description: 'Users businessId',
  })
  businessId: number;
  imageId: number;

  constructor(partial: Partial<UserDto>) {
    Object.assign(this, partial);
  }
}
