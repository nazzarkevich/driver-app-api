import { Expose } from 'class-transformer';
import { ParcelNote, User } from '@prisma/client';

type ParcelNoteWithUser = ParcelNote & {
  user: User;
};

export class ParcelNoteDto {
  @Expose()
  id: number;

  @Expose()
  content: string;

  @Expose()
  parcelId: number;

  @Expose()
  userId: number;

  @Expose()
  userName: string;

  @Expose()
  createdAt: Date;

  @Expose()
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
