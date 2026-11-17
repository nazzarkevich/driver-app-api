import { IsIn, IsNotEmpty, IsString, Matches } from 'class-validator';
import { UserType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { CreateUserDto } from './create-user.dto';
import { ApiProperty, PickType } from '@nestjs/swagger';

export class RegisterStaffDto extends PickType(CreateUserDto, [
  'email',
  'password',
  'firstName',
  'lastName',
] as const) {
  @ApiProperty({ enum: [UserType.InternationalDriver, UserType.ParcelCourier] })
  @IsIn([UserType.InternationalDriver, UserType.ParcelCourier])
  type: UserType;

  @ApiProperty({ example: '+380', required: true })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+[1-9]\d{0,3}$/)
  countryCode: string;

  @ApiProperty({ example: '501234567', required: true })
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.replace(/[\s()-]/g, '').replace(/^0/, '')
      : value,
  )
  @IsString()
  @Matches(/^\d{6,14}$/)
  phoneNumber: string;
}

export class ApproveStaffDto {
  @ApiProperty({ enum: [UserType.InternationalDriver, UserType.ParcelCourier] })
  @IsIn([UserType.InternationalDriver, UserType.ParcelCourier])
  type: UserType;
}
