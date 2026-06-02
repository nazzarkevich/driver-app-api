import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OAuthSignInDto {
  @ApiProperty({
    description: 'OAuth provider (e.g., google, facebook)',
    example: 'google',
  })
  @IsNotEmpty()
  @IsString()
  provider: string;

  @ApiProperty({
    description: 'OAuth token from the provider',
    example: 'ya29.a0AfB_byC3...',
  })
  @IsNotEmpty()
  @IsString()
  token: string;
}
