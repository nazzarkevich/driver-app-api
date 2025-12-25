import { Expose } from 'class-transformer';
import { CourierJourneyNote, User } from '@prisma/client';

type CourierJourneyNoteWithUser = CourierJourneyNote & {
  user: User;
};

@Expose()
export class CourierJourneyNoteDto {
  id: number;
  content: string;
  courierJourneyId: number;
  userId: number;
  userName: string;
  createdAt: Date;
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
