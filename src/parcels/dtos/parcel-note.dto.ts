import { Expose } from 'class-transformer';
import { ParcelNote, User } from '@prisma/client';

type ParcelNoteWithUser = ParcelNote & {
  user: User;
};

@Expose()
export class ParcelNoteDto {
  id: number;
  content: string;
  parcelId: number;
  userId: number;
  userName: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: ParcelNoteWithUser) {
    this.id = partial.id;
    this.content = partial.content;
    this.parcelId = partial.parcelId;
    this.userId = partial.userId;
    this.userName = `${partial.user.firstName} ${partial.user.lastName}`;
    this.createdAt = partial.createdAt;
    this.updatedAt = partial.updatedAt;
  }
}
