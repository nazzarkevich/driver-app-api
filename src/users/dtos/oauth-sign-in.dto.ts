import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppName } from 'src/permissions/permissions';

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
    enum: AppName,
    description:
      'App to authenticate for. Returns 403 if the user lacks access.',
  })
  @IsOptional()
  @IsEnum(AppName)
  app?: AppName;
}
