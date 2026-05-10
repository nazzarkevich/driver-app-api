import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class ParcelTypeDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  description?: string;

  @Expose()
  icon?: string;

  @Expose()
  isActive: boolean;

  @Expose()
  businessId: number | null;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<ParcelTypeDto>) {
    Object.assign(this, partial);
  }
}
