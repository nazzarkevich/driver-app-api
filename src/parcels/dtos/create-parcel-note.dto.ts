import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateParcelNoteDto {
  @ApiProperty({
    example: 'Parcel requires special handling',
    description: 'Note content',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}
