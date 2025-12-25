import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateJourneyNoteDto {
  @ApiProperty({
    example: 'Journey delayed due to weather',
    description: 'Note content',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}
