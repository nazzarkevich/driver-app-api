import { Expose } from 'class-transformer';
import { JourneyNote, User } from '@prisma/client';

type JourneyNoteWithUser = JourneyNote & {
  user: User;
};

@Expose()
export class JourneyNoteDto {
  id: number;
  content: string;
  journeyId: number;
  userId: number;
  userName: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: JourneyNoteWithUser) {
    this.id = partial.id;
    this.content = partial.content;
    this.journeyId = partial.journeyId;
    this.userId = partial.userId;
    this.userName = `${partial.user.firstName} ${partial.user.lastName}`;
    this.createdAt = partial.createdAt;
    this.updatedAt = partial.updatedAt;
  }
}
