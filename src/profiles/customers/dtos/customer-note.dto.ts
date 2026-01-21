import { Expose } from 'class-transformer';
import { CustomerNote, User } from '@prisma/client';

type CustomerNoteWithUser = CustomerNote & {
  user: User;
};

export class CustomerNoteDto {
  @Expose()
  id: number;

  @Expose()
  content: string;

  @Expose()
  customerProfileId: number;

  @Expose()
  userId: number;

  @Expose()
  userName: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  constructor(partial: CustomerNoteWithUser) {
    this.id = partial.id;
    this.content = partial.content;
    this.customerProfileId = partial.customerProfileId;
    this.userId = partial.userId;
    this.userName = `${partial.user.firstName} ${partial.user.lastName}`;
    this.createdAt = partial.createdAt;
    this.updatedAt = partial.updatedAt;
  }
}
