import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token',
    example: 'a1B2c3D4e5F6',
  })
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}
