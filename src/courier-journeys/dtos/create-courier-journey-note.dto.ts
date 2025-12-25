import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCourierJourneyNoteDto {
  @ApiProperty({
    example: 'Traffic delay on route',
    description: 'Note content',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}
