import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class GrantAccessDto {
  @ApiProperty({
    example: 'jane@example.com',
    description: 'Email for the new account',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Temp@1234',
    description: 'Temporary password (customer should change on first login)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  temporaryPassword: string;
}
