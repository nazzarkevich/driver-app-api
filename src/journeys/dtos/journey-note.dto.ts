import { Expose } from 'class-transformer';
import { JourneyNote, User } from '@prisma/client';

type JourneyNoteWithUser = JourneyNote & {
  user: User;
};

export class JourneyNoteDto {
  @Expose()
  id: number;

  @Expose()
  content: string;

  @Expose()
  journeyId: number;

  @Expose()
  userId: number;

  @Expose()
  userName: string;

  @Expose()
  createdAt: Date;

  @Expose()
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
