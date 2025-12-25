import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCustomerNoteDto {
  @ApiProperty({
    example: 'Customer requested callback for delivery',
    description: 'Note content',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}
