import { Expose } from 'class-transformer';
import { CourierJourneyNote, User } from '@prisma/client';

type CourierJourneyNoteWithUser = CourierJourneyNote & {
  user: User;
};

export class CourierJourneyNoteDto {
  @Expose()
  id: number;

  @Expose()
  content: string;

  @Expose()
  courierJourneyId: number;

  @Expose()
  userId: number;

  @Expose()
  userName: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  constructor(partial: CourierJourneyNoteWithUser) {
    this.id = partial.id;
    this.content = partial.content;
    this.courierJourneyId = partial.courierJourneyId;
    this.userId = partial.userId;
    this.userName = `${partial.user.firstName} ${partial.user.lastName}`;
    this.createdAt = partial.createdAt;
    this.updatedAt = partial.updatedAt;
  }
}
