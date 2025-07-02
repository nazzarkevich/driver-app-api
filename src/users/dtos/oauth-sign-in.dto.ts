import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({
    description:
      'Business ID for new users (required for first-time OAuth sign-in)',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  businessId?: number;
}
