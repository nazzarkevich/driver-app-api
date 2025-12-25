import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePhoneDto {
  @ApiProperty({
    example: '07950999888',
    description: 'Phone number without country code',
  })
  @IsString()
  @IsNotEmpty()
  number: string;

  @ApiProperty({
    example: '+44',
    description: 'Phone number country code',
  })
  @IsString()
  @IsNotEmpty()
  countryCode: string;
}
