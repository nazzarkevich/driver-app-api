import { Expose } from 'class-transformer';
import { CustomerNote, User } from '@prisma/client';

type CustomerNoteWithUser = CustomerNote & {
  user: User;
};

@Expose()
export class CustomerNoteDto {
  id: number;
  content: string;
  customerProfileId: number;
  userId: number;
  userName: string;
  createdAt: Date;
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
