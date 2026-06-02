import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { AppName } from 'src/permissions/permissions';

export class SignInDto {
  @ApiProperty({
    example: 'john@gmail.com',
    description: 'Users email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'password1234',
    description: 'Users password',
  })
  @IsString()
  password: string;

  @ApiPropertyOptional({
    enum: AppName,
    description:
      'App to authenticate for. Returns 403 if the user lacks access.',
  })
  @IsOptional()
  @IsEnum(AppName)
  app?: AppName;
}
