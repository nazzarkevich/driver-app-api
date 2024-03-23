import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

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
}
